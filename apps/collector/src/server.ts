import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { normalizeResultado } from "@apuracao/domain";
import { CARGOS, ELEICAO_2026, UFS } from "@apuracao/shared";
import type { TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import type { MunicipiosCache } from "./municipios.ts";
import type { Poller } from "./poller.ts";
import type { RaceStore } from "./store.ts";

export interface ServerDeps {
  config: CollectorConfig;
  store: RaceStore;
  poller: Poller;
  client: TseClient;
  municipios: MunicipiosCache;
  flags: { redis: boolean; postgres: boolean };
}

function query(req: { query: unknown }): Record<string, string> {
  return (req.query ?? {}) as Record<string, string>;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined ? n : fallback;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: deps.config.corsOrigin === "*" ? true : deps.config.corsOrigin.split(","),
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/config", async () => ({
    eleicao: ELEICAO_2026,
    ufs: UFS,
    cargos: CARGOS,
  }));

  app.get("/api/status", async () => ({
    ok: true,
    serverTime: new Date().toISOString(),
    corridas: deps.store.size,
    ultimaAtualizacao: deps.store.latestUpdate(),
    redis: deps.flags.redis,
    postgres: deps.flags.postgres,
    poller: deps.poller.stats,
  }));

  // Resumo de todas as corridas (painel inicial).
  app.get("/api/resumo", async () => {
    const corridas = deps.store.summaries();
    corridas.sort((a, b) => a.cargo - b.cargo || a.uf.localeCompare(b.uf));
    return {
      eleicao: ELEICAO_2026,
      total: corridas.length,
      corridas,
    };
  });

  // Resultado de uma corrida. Sem municipio/zona lê do store (tempo real);
  // com municipio/zona busca sob demanda no TSE (drill-down).
  app.get("/api/resultado", async (req, reply) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, ELEICAO_2026.eleicoes.federal);
    const cargo = toInt(q.cargo, 1);
    const uf = (q.uf ?? "br").toLowerCase();

    if (q.municipio || q.zona) {
      const raw = await deps.client.getResultado({
        ciclo: ELEICAO_2026.ciclo,
        cdEleicao: eleicao,
        cargo,
        uf,
        municipio: q.municipio,
        zona: q.zona,
      });
      if (!raw) return reply.code(404).send({ error: "sem dados para a localidade" });
      return normalizeResultado(raw);
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
    const eleicao = toInt(q.eleicao, ELEICAO_2026.eleicoes.federal);
    const cargo = toInt(q.cargo, 1);
    const uf = (q.uf ?? "br").toLowerCase();
    const snapshots = deps.store.historico(eleicao, cargo, uf);
    if (snapshots.length === 0) {
      return reply.code(404).send({ error: "sem histórico para a corrida" });
    }
    return { eleicao, cargo, uf, snapshots };
  });

  app.get("/api/municipios", async (req) => {
    const q = query(req);
    const eleicao = toInt(q.eleicao, ELEICAO_2026.eleicoes.estadual);
    const uf = (q.uf ?? "sp").toLowerCase();
    const municipios = await deps.municipios.municipiosOf(eleicao, uf);
    return { eleicao, uf, total: municipios.length, municipios };
  });

  // SSE: empurra atualizações conforme novas gerações chegam.
  app.get("/api/live", (req, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": deps.config.corsOrigin,
    });
    raw.write(`retry: 5000\n`);
    raw.write(`event: hello\ndata: ${JSON.stringify({ corridas: deps.store.size, at: new Date().toISOString() })}\n\n`);

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
    });
  });

  return app;
}
