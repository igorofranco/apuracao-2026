import { TseClient } from "@apuracao/tse-client";
import { loadConfig } from "./config.ts";
import { RaceStore } from "./store.ts";
import { createPostgresRepo } from "./persistence.ts";
import { buildTargets } from "./targets.ts";
import { Poller } from "./poller.ts";
import { MunicipiosCache } from "./municipios.ts";
import { MunicipiosPresidente } from "./municipios-presidente.ts";
import { LocalidadesCache } from "./localidades.ts";
import { buildServer } from "./server.ts";
import { RedisBridge } from "./broadcast.ts";
import { Logger } from "./logger.ts";
import {
  coletaDoSegundoTurnoLiberada,
  eleicoesSegundoTurno2026,
  INICIO_COLETA_SEGUNDO_TURNO,
  msAteColetaDoSegundoTurno,
  resolverEleicoes,
} from "./eleicoes.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const log = new Logger({ level: config.log.level, format: config.log.format });

  const client = new TseClient({
    baseUrl: config.tse.baseUrl,
    ambiente: config.tse.ambiente,
    verifyJws: config.tse.verifyJws,
    timeoutMs: config.tse.timeoutMs,
  });

  // Antes das 16h de domingo não tocamos no TSE: usamos os códigos conhecidos
  // do 2º turno de 2026 e só resolvemos o config depois da liberação.
  const liberada = coletaDoSegundoTurnoLiberada();
  const eleicoes = liberada
    ? await resolverEleicoes(client, config, log)
    : eleicoesSegundoTurno2026();
  if (!liberada) {
    log.info("coleta do 2º turno ainda não liberada; usando eleições hardcoded", {
      inicio: INICIO_COLETA_SEGUNDO_TURNO,
      federal: eleicoes.federal.cd,
      estadual: eleicoes.estadual.cd,
    });
  }

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
  const alvosRapidos = targets.filter((t) => t.grupo === "rapida");
  const alvosLentos = targets.filter((t) => t.grupo === "lenta");
  // Cartões nacionais (Presidente BR) a cada 15 s; mapa por UF, governadores e
  // cargos decididos a cada 60 s. Duas cadências independentes evitam gastar
  // requisições com dados que mudam pouco.
  const poller = new Poller({
    client,
    store,
    targets: alvosRapidos,
    eleicoes,
    config,
    log,
    nome: "rapido",
  });
  const pollerLento = new Poller({
    client,
    store,
    targets: alvosLentos,
    eleicoes,
    log,
    nome: "lento",
    config: {
      ...config,
      poll: {
        ...config.poll,
        activeMs: config.poll.slowMs,
        idleMs: config.poll.slowIdleMs,
      },
    },
  });
  const municipios = new MunicipiosCache(client, eleicoes.ciclo);
  const localidades = new LocalidadesCache(client, 15_000);
  const municipiosPresidente = new MunicipiosPresidente({
    client,
    municipios,
    eleicoes,
    log,
    workers: config.municipios.workers,
    intervalMs: config.municipios.intervalMs,
    refreshMs: config.municipios.refreshMs,
    once: config.poll.mode === "once",
  });
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
    pollerLento,
    client,
    municipios,
    localidades,
    municipiosPresidente,
    eleicoes,
    log,
    flags: { redis: Boolean(bridge), redisOk, postgres: Boolean(repo) },
  });

  await server.listen({ host: config.host, port: config.port });
  log.info("collector ouvindo", {
    host: config.host,
    porta: config.port,
    alvos: targets.length,
    alvosRapidos: alvosRapidos.length,
    alvosLentos: alvosLentos.length,
    jws: config.tse.verifyJws,
    ciclo: eleicoes.ciclo,
    federal: eleicoes.federal.cd,
    estadual: eleicoes.estadual.cd,
  });

  const iniciarColeta = () => {
    // No modo `once` cada cadência faz uma única rodada e para; caso contrário,
    // polling contínuo normal.
    if (config.poll.mode === "once") {
      log.info("polling em modo once: uma rodada e para");
      void Promise.allSettled([poller.runOnce(), pollerLento.runOnce()]).then(
        (resultados) => {
          for (const r of resultados) {
            if (r.status === "rejected") {
              log.warn("rodada única falhou", {
                erro:
                  r.reason instanceof Error
                    ? r.reason.message
                    : String(r.reason),
              });
            }
          }
        },
      );
    } else {
      poller.start();
      pollerLento.start();
    }

    // Coleta municipal do 2º turno: gradual, em segundo plano, para o mapa por
    // município. No modo `once` faz uma única varredura e para.
    if (config.municipios.enabled && eleicoes.federal.turno > 1) {
      log.info("coleta municipal do 2º turno habilitada", {
        workers: config.municipios.workers,
        intervaloMs: config.municipios.intervalMs,
        refreshMs: config.municipios.refreshMs,
        modo: config.poll.mode,
      });
      municipiosPresidente.iniciar();
    } else if (!config.municipios.enabled) {
      log.info(
        "coleta municipal do 2º turno desabilitada (MUNICIPIOS_POLL=false)",
      );
    }
  };

  // Gate hardcoded: nada de requisição ao TSE antes de domingo, 25/10, 16h
  // (horário de Brasília). O servidor sobe normalmente e serve o painel vazio;
  // a coleta é agendada para a liberação.
  let inicioTimer: NodeJS.Timeout | undefined;
  if (coletaDoSegundoTurnoLiberada()) {
    iniciarColeta();
  } else {
    const espera = msAteColetaDoSegundoTurno();
    log.info("coleta do 2º turno agendada", {
      inicio: INICIO_COLETA_SEGUNDO_TURNO,
      emMinutos: Math.ceil(espera / 60_000),
    });
    inicioTimer = setTimeout(() => {
      inicioTimer = undefined;
      log.info("liberando a coleta do 2º turno", {
        inicio: INICIO_COLETA_SEGUNDO_TURNO,
      });
      iniciarColeta();
    }, espera);
    inicioTimer.unref?.();
  }

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
    if (inicioTimer) clearTimeout(inicioTimer);
    poller.stop();
    pollerLento.stop();
    municipiosPresidente.parar();
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
