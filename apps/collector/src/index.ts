import { TseClient } from "@apuracao/tse-client";
import { loadConfig } from "./config.ts";
import { RaceStore } from "./store.ts";
import { createPostgresRepo } from "./persistence.ts";
import { buildTargets } from "./targets.ts";
import { Poller } from "./poller.ts";
import { MunicipiosCache } from "./municipios.ts";
import { LocalidadesCache } from "./localidades.ts";
import { buildServer } from "./server.ts";
import { RedisBridge } from "./broadcast.ts";
import { Logger } from "./logger.ts";
import { resolverEleicoes } from "./eleicoes.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = new Logger({ level: config.log.level, format: config.log.format });

  const client = new TseClient({
    baseUrl: config.tse.baseUrl,
    ambiente: config.tse.ambiente,
    verifyJws: config.tse.verifyJws,
    timeoutMs: config.tse.timeoutMs,
  });

  const eleicoes = await resolverEleicoes(client, config, log);

  const repo = config.databaseUrl
    ? await createPostgresRepo({ connectionString: config.databaseUrl, log })
    : undefined;
  const store = new RaceStore({ snapshotLimit: config.snapshotLimit, repo });
  if (repo) {
    await store.hydrate();
    log.info("histórico durável (Postgres) habilitado", {
      retencaoDias: config.history.retentionDays,
    });
  }

  const targets = buildTargets(eleicoes);
  const poller = new Poller({ client, store, targets, eleicoes, config, log });
  const municipios = new MunicipiosCache(client, eleicoes.ciclo);
  const localidades = new LocalidadesCache(client, 15_000);
  const bridge = config.redisUrl
    ? await RedisBridge.create(config.redisUrl, store, log)
    : undefined;
  const redisOk = bridge ? await bridge.ping() : false;
  if (bridge) {
    log.info("Redis habilitado (fan-out de SSE entre instâncias)", { conectado: redisOk });
  }

  const server = await buildServer({
    config,
    store,
    poller,
    client,
    municipios,
    localidades,
    eleicoes,
    log,
    flags: { redis: Boolean(bridge), redisOk, postgres: Boolean(repo) },
  });

  await server.listen({ host: config.host, port: config.port });
  log.info("collector ouvindo", {
    host: config.host,
    porta: config.port,
    alvos: targets.length,
    jws: config.tse.verifyJws,
    ciclo: eleicoes.ciclo,
    federal: eleicoes.federal.cd,
    estadual: eleicoes.estadual.cd,
  });

  poller.start();

  // Retenção do histórico (limpa snapshots antigos no Postgres).
  let pruneTimer: NodeJS.Timeout | undefined;
  if (repo) {
    const aplicarRetencao = async () => {
      try {
        const removidos = await store.prune(config.history.retentionDays);
        if (removidos > 0) log.info("retenção do histórico aplicada", { removidos });
      } catch (err) {
        log.warn("falha ao aplicar retenção", {
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    };
    void aplicarRetencao();
    pruneTimer = setInterval(aplicarRetencao, config.history.pruneIntervalMs);
    pruneTimer.unref?.();
  }

  // Sinaliza "pronto" para o PM2 (wait_ready).
  process.send?.("ready");

  const shutdown = async (signal: string) => {
    log.info("encerrando", { sinal: signal });
    poller.stop();
    if (pruneTimer) clearInterval(pruneTimer);
    await server.close();
    await bridge?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[collector] falha fatal:", err);
  process.exit(1);
});
