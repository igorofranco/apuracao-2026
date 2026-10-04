import { TseClient } from "@apuracao/tse-client";
import { ELEICAO_2026 } from "@apuracao/shared";
import { loadConfig } from "./config.ts";
import { RaceStore } from "./store.ts";
import { createPostgresRepo } from "./persistence.ts";
import { buildTargets } from "./targets.ts";
import { Poller } from "./poller.ts";
import { MunicipiosCache } from "./municipios.ts";
import { buildServer } from "./server.ts";
import { RedisBridge } from "./broadcast.ts";

async function main(): Promise<void> {
  const config = loadConfig();

  const client = new TseClient({
    baseUrl: config.tse.baseUrl,
    ambiente: config.tse.ambiente,
    verifyJws: config.tse.verifyJws,
    timeoutMs: config.tse.timeoutMs,
  });

  const repo = config.databaseUrl
    ? await createPostgresRepo(config.databaseUrl)
    : undefined;
  const store = new RaceStore({ snapshotLimit: config.snapshotLimit, repo });
  await store.hydrate();

  const targets = buildTargets();
  const poller = new Poller({ client, store, targets, config });
  const municipios = new MunicipiosCache(client, ELEICAO_2026.ciclo);
  const bridge = config.redisUrl
    ? await RedisBridge.create(config.redisUrl, store)
    : undefined;

  const server = await buildServer({
    config,
    store,
    poller,
    client,
    municipios,
    flags: { redis: Boolean(bridge), postgres: Boolean(repo) },
  });

  await server.listen({ host: config.host, port: config.port });
  console.log(
    `[collector] ouvindo em http://${config.host}:${config.port} | ` +
      `${targets.length} alvos | JWS=${config.tse.verifyJws}`,
  );

  poller.start();

  const shutdown = async (signal: string) => {
    console.log(`[collector] encerrando (${signal})...`);
    poller.stop();
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
