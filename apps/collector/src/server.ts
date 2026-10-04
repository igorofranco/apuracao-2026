import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { CARGOS, UFS } from "@apuracao/shared";
import type { TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import type { EleicoesResolvidas } from "./eleicoes.ts";
import type { LocalidadesCache } from "./localidades.ts";
import type { Logger } from "./logger.ts";
import type { MunicipiosCache } from "./municipios.ts";
import type { Poller } from "./poller.ts";
import type { RaceStore } from "./store.ts";

export interface ServerDeps {
  config: CollectorConfig;
  store: RaceStore;
  poller: Poller;
  client: TseClient;
  municipios: MunicipiosCache;
  localidades: LocalidadesCache;
  eleicoes: EleicoesResolvidas;
  log: Logger;
  flags: { redis: boolean; redisOk: boolean; postgres: boolean };
}

function query(req: { query: unknown }): Record<string, string> {
  return (req.query ?? {}) as Record<string, string>;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined ? n : fallback;
}

/** Bloco de exposição de uma métrica no formato do Prometheus. */
function metric(
  nome: string,
  tipo: "gauge" | "counter",
  help: string,
  valor: number,
): string[] {
  return [`# HELP ${nome} ${help}`, `# TYPE ${nome} ${tipo}`, `${nome} ${valor}`];
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: true });

  await app.register(cors, { origin: deps.config.corsOrigins });

  await app.register(rateLimit, {
    max: deps.config.rateLimit.max,
    timeWindow: deps.config.rateLimit.windowMs,
    allowList: [],
  });

  const ssePorIp = new Map<string, number>();
  const totalSse = () => [...ssePorIp.values()].reduce((a, b) => a + b, 0);

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/config", async () => ({
    eleicao: deps.eleicoes,
    ufs: UFS,
    cargos: CARGOS,
  }));

  app.get("/api/status", async () => ({
    ok: true,
    serverTime: new Date().toISOString(),
    corridas: deps.store.size,
    ultimaAtualizacao: deps.store.latestUpdate(),
    eleicoes: deps.eleicoes,
    redis: deps.flags.redis,
    redisConectado: deps.flags.redisOk,
    postgres: deps.flags.postgres,
    historyRetentionDays: deps.config.history.retentionDays,
    localidadesEmCache: deps.localidades.tamanho,
    sseClientes: totalSse(),
    poller: deps.poller.stats,
  }));

  // Métricas em formato Prometheus (texto).
  app.get("/api/metrics", async (_req, reply) => {
    reply.header("content-type", "text/plain; version=0.0.4");
    const s = deps.poller.stats;
    const linhas = [
      ...metric("apuracao_corridas", "gauge", "Corridas na memória", deps.store.size),
      ...metric("apuracao_sse_clientes", "gauge", "Conexões SSE ativas", totalSse()),
      ...metric("apuracao_poller_rodadas", "counter", "Rodadas do poller", s.runs),
      ...metric(
        "apuracao_atualizacoes",
        "counter",
        "Total de atualizações detectadas",
        s.totalUpdates,
      ),
      ...metric("apuracao_falhas", "counter", "Falhas de coleta", s.failures),
      ...metric("apuracao_jws_falhas", "counter", "Assinaturas JWS inválidas", s.jwsFailures),
      ...metric("apuracao_nao_encontrados", "counter", "Arquivos 404", s.notFound),
      ...metric(
        "apuracao_uptime_segundos",
        "gauge",
        "Uptime do processo",
        Math.floor(process.uptime()),
      ),
    ];
    return linhas.join("\n") + "\n";
  });

  app.get("/api/resumo", async () => {
    const corridas = deps.store.summaries();
    corridas.sort((a, b) => a.cargo - b.cargo || a.uf.localeCompare(b.uf));
    return { eleicao: deps.eleicoes, total: corridas.length, corridas };
  });

  // Resultado de uma corrida. Sem municipio/zona lê do store (tempo real);
  // com municipio/zona usa cache com TTL (busca sob demanda no TSE).
  app.get("/api/resultado", async (req, reply) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, deps.eleicoes.federal.cd);
    const cargo = toInt(q.cargo, 1);
    const uf = (q.uf ?? "br").toLowerCase();

    if (q.municipio || q.zona) {
      const race = await deps.localidades.get({
        ciclo: deps.eleicoes.ciclo,
        eleicao,
        cargo,
        uf,
        municipio: q.municipio,
        zona: q.zona,
      });
      if (!race) return reply.code(404).send({ error: "sem dados para a localidade" });
      return race;
    }

    const race = deps.store.getRace(eleicao, cargo, uf);
    if (!race) {
      return reply.code(404).send({
        error: "corrida não encontrada",
        dica: "pode ainda não ter sido coletada; tente novamente em instantes",
      });
    }
    return race;
  });

  app.get("/api/historico", async (req, reply) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, deps.eleicoes.federal.cd);
    const cargo = toInt(q.cargo, 1);
    const uf = (q.uf ?? "br").toLowerCase();
    const snapshots = await deps.store.historicoAsync(eleicao, cargo, uf, {
      since: q.since,
      limit: deps.config.history.maxPoints,
      retentionDays: deps.config.history.retentionDays,
    });
    if (snapshots.length === 0) {
      return reply.code(404).send({ error: "sem histórico para a corrida" });
    }
    return { eleicao, cargo, uf, snapshots };
  });

  app.get("/api/municipios", async (req) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, deps.eleicoes.estadual.cd);
    const uf = (q.uf ?? "sp").toLowerCase();
    const municipios = await deps.municipios.municipiosOf(eleicao, uf);
    return { eleicao, uf, total: municipios.length, municipios };
  });

  // SSE: empurra atualizações conforme novas gerações chegam.
  // Fora do rate limit global; aplica limite próprio de conexões por IP.
  app.get(
    "/api/live",
    { config: { rateLimit: false } },
    (req, reply) => {
      const ip = req.ip;
      const atual = ssePorIp.get(ip) ?? 0;
      if (atual >= deps.config.maxSsePerIp) {
        return reply.code(429).send({ error: "muitas conexões ao vivo para este IP" });
      }
      ssePorIp.set(ip, atual + 1);

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      raw.write(`retry: 5000\n`);
      raw.write(
        `event: hello\ndata: ${JSON.stringify({ corridas: deps.store.size, at: new Date().toISOString() })}\n\n`,
      );

      const onUpdate = (update: { key: string; at: string; race: unknown }) => {
        raw.write(
          `event: update\ndata: ${JSON.stringify({ key: update.key, at: update.at, race: update.race })}\n\n`,
        );
      };
      deps.store.on("update", onUpdate);

      const heartbeat = setInterval(() => raw.write(`: ping\n\n`), 15_000);
      req.raw.on("close", () => {
        clearInterval(heartbeat);
        deps.store.off("update", onUpdate);
        const n = (ssePorIp.get(ip) ?? 1) - 1;
        if (n <= 0) ssePorIp.delete(ip);
        else ssePorIp.set(ip, n);
      });
    },
  );

  return app;
}
