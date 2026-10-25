function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return ["1", "true", "sim", "s", "yes"].includes(raw.toLowerCase());
}

function lista(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface CollectorConfig {
  host: string;
  port: number;
  log: { level: "debug" | "info" | "warn" | "error"; format: "pretty" | "json" };
  tse: {
    baseUrl: string;
    ambiente: string;
    verifyJws: boolean;
    timeoutMs: number;
    ciclo: string;
    /** Códigos de eleição fixos (opcionais); se ausentes, são resolvidos do config do TSE. */
    eleicaoFederal?: number;
    eleicaoEstadual?: number;
    /** Resolve os códigos de eleição a partir do config do TSE (suporta 2º turno). */
    resolverEleicoes: boolean;
  };
  poll: {
    /**
     * `continuous`: coleta em regime normal (padrão).
     * `once`: faz uma única rodada no boot — só para repovoar a memória do painel
     * após um restart — e não agenda mais nenhuma coleta.
     */
    mode: "continuous" | "once";
    /** Cadência dos alvos rápidos (Presidente nacional, cartões em tempo real). */
    activeMs: number;
    idleMs: number;
    /** Cadência dos alvos lentos (mapa por UF, governadores e cargos decididos). */
    slowMs: number;
    slowIdleMs: number;
    /** Teto do backoff quando o TSE está falhando repetidamente. */
    maxBackoffMs: number;
    concurrency: number;
    /** Tentativas por arquivo em cada rodada. */
    retries: number;
    runOnStart: boolean;
  };
  /**
   * Coleta municipal do 2º turno (mapa por município). Roda em segundo plano,
   * com uma requisição por vez e intervalo entre elas.
   */
  municipios: {
    enabled: boolean;
    /** Requisições simultâneas na varredura municipal (1–4). */
    workers: number;
    /** Intervalo entre duas requisições de um mesmo worker (ms). */
    intervalMs: number;
    /** Espera entre o fim de uma varredura e o início da próxima (ms). */
    refreshMs: number;
  };
  redisUrl?: string;
  databaseUrl?: string;
  snapshotLimit: number;
  history: {
    /** Retenção dos snapshots no Postgres (dias). */
    retentionDays: number;
    /** Máximo de pontos retornados por consulta de histórico. */
    maxPoints: number;
    /** Máximo de pontos no gráfico de evolução (série reduzida no servidor). */
    chartPoints: number;
    /** Intervalo de limpeza da retenção (ms). */
    pruneIntervalMs: number;
  };
  corsOrigins: string[];
  rateLimit: { max: number; windowMs: number };
  /** Nº máximo de conexões SSE simultâneas por IP. */
  maxSsePerIp: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: int("PORT", 8787),
    log: {
      level: (env.LOG_LEVEL as CollectorConfig["log"]["level"]) ?? "info",
      format: (env.LOG_FORMAT as CollectorConfig["log"]["format"]) ?? "pretty",
    },
    tse: {
      baseUrl: env.TSE_BASE_URL ?? "https://resultados.tse.jus.br/",
      ambiente: env.TSE_AMBIENTE ?? "oficial",
      verifyJws: bool("TSE_VERIFY_JWS", true),
      timeoutMs: int("TSE_TIMEOUT_MS", 15_000),
      ciclo: env.TSE_CICLO ?? "ele2026",
      eleicaoFederal: env.TSE_ELEICAO_FEDERAL ? int("TSE_ELEICAO_FEDERAL", 0) : undefined,
      eleicaoEstadual: env.TSE_ELEICAO_ESTADUAL ? int("TSE_ELEICAO_ESTADUAL", 0) : undefined,
      resolverEleicoes: bool("TSE_ELEICOES_AUTO", true),
    },
    poll: {
      mode: env.POLL_MODE === "once" ? "once" : "continuous",
      activeMs: int("POLL_ACTIVE_MS", 15_000),
      idleMs: int("POLL_IDLE_MS", 60_000),
      slowMs: int("POLL_SLOW_MS", 60_000),
      slowIdleMs: int("POLL_SLOW_IDLE_MS", 300_000),
      maxBackoffMs: int("POLL_MAX_BACKOFF_MS", 300_000),
      concurrency: int("POLL_CONCURRENCY", 8),
      retries: int("POLL_RETRIES", 2),
      runOnStart: bool("POLL_RUN_ON_START", true),
    },
    municipios: {
      enabled: bool("MUNICIPIOS_POLL", true),
      workers: Math.max(1, Math.min(4, int("MUNICIPIOS_WORKERS", 2))),
      intervalMs: Math.max(0, int("MUNICIPIOS_POLL_INTERVAL_MS", 150)),
      refreshMs: Math.max(0, int("MUNICIPIOS_REFRESH_MS", 30_000)),
    },
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
    snapshotLimit: int("SNAPSHOT_LIMIT", 500),
    history: {
      retentionDays: int("HISTORY_RETENTION_DAYS", 7),
      maxPoints: int("HISTORY_MAX_POINTS", 5000),
      chartPoints: int("HISTORY_CHART_POINTS", 400),
      pruneIntervalMs: int("HISTORY_PRUNE_INTERVAL_MS", 6 * 60 * 60 * 1000),
    },
    corsOrigins: lista("CORS_ORIGIN", ["http://localhost:3000"]),
    rateLimit: {
      max: int("RATE_LIMIT_MAX", 300),
      windowMs: int("RATE_LIMIT_WINDOW_MS", 60_000),
    },
    maxSsePerIp: int("MAX_SSE_PER_IP", 10),
  };
}
