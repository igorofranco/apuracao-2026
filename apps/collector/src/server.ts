import { gzipSync } from "node:zlib";
import type { ServerResponse } from "node:http";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { CARGOS, UFS } from "@apuracao/shared";
import type { TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import {
  coletaDoSegundoTurnoLiberada,
  type EleicoesResolvidas,
} from "./eleicoes.ts";
import type { LocalidadesCache } from "./localidades.ts";
import type { Logger } from "./logger.ts";
import type { MunicipiosCache } from "./municipios.ts";
import type { MunicipiosPresidente } from "./municipios-presidente.ts";
import type { Poller } from "./poller.ts";
import type { RaceStore } from "./store.ts";

export interface ServerDeps {
  config: CollectorConfig;
  store: RaceStore;
  poller: Poller;
  /** Cadência lenta (mapa por UF, governadores e cargos decididos). */
  pollerLento?: Poller;
  client: TseClient;
  municipios: MunicipiosCache;
  localidades: LocalidadesCache;
  municipiosPresidente: MunicipiosPresidente;
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
  /** Conexões SSE ativas (para o aviso de fim de ciclo municipal). */
  const sseStreams = new Set<ServerResponse>();
  /** Cache do último payload municipal serializado/compactado. */
  let cacheMunicipal: {
    chave: string;
    json: string;
    gzip: Buffer;
  } | null = null;
  // Antes da liberação hardcoded (domingo 16h), rotas que buscam localidade
  // sob demanda no TSE ficam bloqueadas. O store e o /api/resumo não tocam no
  // TSE e continuam normais.
  const coletaBloqueada = () =>
    deps.eleicoes.federal.turno > 1 && !coletaDoSegundoTurnoLiberada();
  const respostaBloqueada = {
    error: "coleta do 2º turno começa em 25/10 às 16h (horário de Brasília)",
  };

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
    pollerLento: deps.pollerLento?.stats ?? null,
    municipios: {
      ...deps.municipiosPresidente.stats,
      enabled: deps.config.municipios.enabled,
      workers: deps.config.municipios.workers,
      intervaloMs: deps.config.municipios.intervalMs,
    },
  }));

  // Métricas em formato Prometheus (texto).
  app.get("/api/metrics", async (_req, reply) => {
    reply.header("content-type", "text/plain; version=0.0.4");
    const s = deps.poller.stats;
    const lento = deps.pollerLento?.stats;
    const mun = deps.municipiosPresidente.stats;
    const linhas = [
      ...metric("apuracao_corridas", "gauge", "Corridas na memória", deps.store.size),
      ...metric("apuracao_sse_clientes", "gauge", "Conexões SSE ativas", totalSse()),
      ...metric("apuracao_poller_rodadas", "counter", "Rodadas do poller rápido", s.runs),
      ...metric(
        "apuracao_atualizacoes",
        "counter",
        "Total de atualizações detectadas (rápido)",
        s.totalUpdates,
      ),
      ...metric("apuracao_falhas", "counter", "Falhas de coleta (rápido)", s.failures),
      ...metric("apuracao_jws_falhas", "counter", "Assinaturas JWS inválidas", s.jwsFailures),
      ...metric("apuracao_nao_encontrados", "counter", "Arquivos 404", s.notFound),
      ...metric(
        "apuracao_poller_lento_rodadas",
        "counter",
        "Rodadas do poller lento",
        lento?.runs ?? 0,
      ),
      ...metric(
        "apuracao_poller_lento_atualizacoes",
        "counter",
        "Atualizações detectadas (lento)",
        lento?.totalUpdates ?? 0,
      ),
      ...metric(
        "apuracao_municipios_total",
        "gauge",
        "Municípios a coletar",
        mun.total,
      ),
      ...metric(
        "apuracao_municipios_coletados",
        "gauge",
        "Municípios já coletados",
        mun.coletados,
      ),
      ...metric(
        "apuracao_municipios_ciclos",
        "counter",
        "Varreduras municipais completas",
        mun.ciclos,
      ),
      ...metric(
        "apuracao_municipios_revisao",
        "counter",
        "Revisão do snapshot municipal",
        mun.revisao,
      ),
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
      if (coletaBloqueada()) {
        return reply.code(503).send(respostaBloqueada);
      }
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

  app.get("/api/municipios", async (req, reply) => {
    if (coletaBloqueada()) {
      return reply.code(503).send(respostaBloqueada);
    }
    const q = query(req);
    const eleicao = toInt(q.eleicao, deps.eleicoes.estadual.cd);
    const uf = (q.uf ?? "sp").toLowerCase();
    const municipios = await deps.municipios.municipiosOf(eleicao, uf);
    return { eleicao, uf, total: municipios.length, municipios };
  });

  /**
   * Presidente por município (mapa do 2º turno). Lê o cache alimentado em
   * segundo plano pelo `MunicipiosPresidente`; a requisição nunca dispara uma
   * rajada de chamadas ao TSE.
   *
   * - `?uf=sp`: snapshot detalhado da UF (compatibilidade/depuração).
   * - sem `uf`: snapshot nacional compacto, com todos os municípios em uma
   *   única resposta pronta para o browser (`[cdi, uf, votosA, votosB]`).
   *   Suporta ETag, cache HTTP e gzip.
   */
  app.get("/api/presidente/municipios", async (req, reply) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, deps.eleicoes.federal.cd);
    const uf = (q.uf ?? "").toLowerCase();
    const desabilitado =
      !deps.config.municipios.enabled || deps.eleicoes.federal.turno <= 1;

    if (uf) {
      const snapshot = deps.municipiosPresidente.snapshot(eleicao, uf);
      if (!snapshot) {
        return reply
          .code(404)
          .send({ error: "eleição não é a presidencial atual" });
      }
      return { ...snapshot, desabilitado };
    }

    let a = q.a?.trim();
    let b = q.b?.trim();
    if (!a || !b) {
      // Sem candidatos explícitos, usa os dois mais votados da corrida nacional.
      const race = deps.store.getRace(eleicao, 1, "br");
      const numeros = (race?.candidatos ?? [])
        .slice()
        .sort((x, y) => y.votos - x.votos)
        .slice(0, 2)
        .map((c) => c.numero);
      if (numeros.length === 2) {
        [a, b] = numeros;
      }
    }
    if (!a || !b || !/^\d{1,3}$/.test(a) || !/^\d{1,3}$/.test(b)) {
      return reply.code(400).send({
        error:
          "informe os números dos candidatos (a e b) ou aguarde a corrida nacional",
      });
    }

    if (eleicao !== deps.eleicoes.federal.cd) {
      return reply
        .code(404)
        .send({ error: "eleição não é a presidencial atual" });
    }

    // ETag/Cache-Control antes de montar o payload: quando nada mudou, o
    // browser recebe 304 sem custo de serializar/compactar 5.500 municípios.
    const liberado = coletaDoSegundoTurnoLiberada();
    const stats = deps.municipiosPresidente.stats;
    const etag = `"mun-${stats.revisao}-${a}-${b}-${liberado ? 1 : 0}-${desabilitado ? 1 : 0}"`;
    reply.header("etag", etag);
    reply.header(
      "cache-control",
      stats.total > 0 && stats.coletados >= stats.total
        ? "public, max-age=60, stale-while-revalidate=120"
        : "public, max-age=15, stale-while-revalidate=30",
    );
    reply.header("vary", "Accept-Encoding");

    const ifNoneMatch = req.headers["if-none-match"];
    if (
      ifNoneMatch &&
      ifNoneMatch.split(",").some((valor) => valor.trim() === etag)
    ) {
      return reply.code(304).send();
    }

    const snapshot = deps.municipiosPresidente.snapshotBrasil(
      eleicao,
      a,
      b,
    );
    if (!snapshot) {
      return reply
        .code(404)
        .send({ error: "eleição não é a presidencial atual" });
    }

    const corpo = { ...snapshot, liberado, desabilitado };
    const chave = `${snapshot.revisao}:${a}:${b}:${liberado}:${desabilitado}`;
    if (cacheMunicipal?.chave !== chave) {
      const json = JSON.stringify(corpo);
      cacheMunicipal = { chave, json, gzip: gzipSync(json) };
    }
    reply.type("application/json");
    if (/\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      reply.header("content-encoding", "gzip");
      return reply.send(cacheMunicipal.gzip);
    }
    return reply.send(cacheMunicipal.json);
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
      sseStreams.add(raw);
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
        sseStreams.delete(raw);
        deps.store.off("update", onUpdate);
        const n = (ssePorIp.get(ip) ?? 1) - 1;
        if (n <= 0) ssePorIp.delete(ip);
        else ssePorIp.set(ip, n);
      });
    },
  );

  // Avisa os browsers quando uma varredura municipal completa (uma vez por
  // ciclo). O cliente então invalida o snapshot nacional; durante o ciclo ele
  // usa o cache/ETag e o refetch periódico, sem baixar o payload a cada lote.
  let ultimoCicloMunicipal = -1;
  const municipiosTimer = setInterval(() => {
    const progresso = deps.municipiosPresidente.progresso(
      deps.eleicoes.federal.cd,
    );
    if (
      !progresso ||
      progresso.ciclos === ultimoCicloMunicipal ||
      progresso.total === 0
    ) {
      return;
    }
    ultimoCicloMunicipal = progresso.ciclos;
    const evento = `event: municipios\ndata: ${JSON.stringify({
      revisao: progresso.revisao,
      ciclos: progresso.ciclos,
      total: progresso.total,
      coletados: progresso.coletados,
      atualizadoEm: progresso.atualizadoEm,
    })}\n\n`;
    for (const stream of sseStreams) {
      try {
        stream.write(evento);
      } catch {
        sseStreams.delete(stream);
      }
    }
  }, 10_000);
  municipiosTimer.unref?.();
  app.addHook("onClose", () => clearInterval(municipiosTimer));

  return app;
}
