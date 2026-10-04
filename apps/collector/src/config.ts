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

export interface CollectorConfig {
  host: string;
  port: number;
  tse: {
    baseUrl: string;
    ambiente: string;
    verifyJws: boolean;
    timeoutMs: number;
  };
  poll: {
    activeMs: number;
    idleMs: number;
    concurrency: number;
    /** Quando true, o coletor faz uma rodada imediata ao subir. */
    runOnStart: boolean;
  };
  redisUrl?: string;
  databaseUrl?: string;
  snapshotLimit: number;
  corsOrigin: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollectorConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: int("PORT", 8787),
    tse: {
      baseUrl: env.TSE_BASE_URL ?? "https://resultados.tse.jus.br/",
      ambiente: env.TSE_AMBIENTE ?? "oficial",
      verifyJws: bool("TSE_VERIFY_JWS", true),
      timeoutMs: int("TSE_TIMEOUT_MS", 15_000),
    },
    poll: {
      activeMs: int("POLL_ACTIVE_MS", 15_000),
      idleMs: int("POLL_IDLE_MS", 60_000),
      concurrency: int("POLL_CONCURRENCY", 8),
      runOnStart: bool("POLL_RUN_ON_START", true),
    },
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
    snapshotLimit: int("SNAPSHOT_LIMIT", 2_000),
    corsOrigin: env.CORS_ORIGIN ?? "*",
  };
}
