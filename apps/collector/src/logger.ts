/** Logger mínimo com níveis e saída JSON opcional (para pm2/coleta de logs). */

type Nivel = "debug" | "info" | "warn" | "error";

const ORDEM: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  level?: Nivel;
  format?: "pretty" | "json";
  base?: Record<string, unknown>;
}

export class Logger {
  private readonly min: number;
  private readonly format: "pretty" | "json";
  private readonly base: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.min = ORDEM[options.level ?? "info"];
    this.format = options.format ?? "pretty";
    this.base = options.base ?? {};
  }

  child(extra: Record<string, unknown>): Logger {
    return new Logger({
      level: nivelFromOrdinal(this.min),
      format: this.format,
      base: { ...this.base, ...extra },
    });
  }

  debug(msg: string, campos?: Record<string, unknown>) {
    this.escrever("debug", msg, campos);
  }
  info(msg: string, campos?: Record<string, unknown>) {
    this.escrever("info", msg, campos);
  }
  warn(msg: string, campos?: Record<string, unknown>) {
    this.escrever("warn", msg, campos);
  }
  error(msg: string, campos?: Record<string, unknown>) {
    this.escrever("error", msg, campos);
  }

  private escrever(nivel: Nivel, msg: string, campos?: Record<string, unknown>) {
    if (ORDEM[nivel] < this.min) return;
    const registro = { nivel, msg, ...this.base, ...campos };
    if (this.format === "json") {
      process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...registro })}\n`);
      return;
    }
    const sufixo = campos && Object.keys(campos).length
      ? " " + Object.entries(campos).map(([k, v]) => `${k}=${formatar(v)}`).join(" ")
      : "";
    process.stdout.write(`[${nivel}] ${msg}${sufixo}\n`);
  }
}

function formatar(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function nivelFromOrdinal(n: number): Nivel {
  if (n >= ORDEM.error) return "error";
  if (n >= ORDEM.warn) return "warn";
  if (n >= ORDEM.info) return "info";
  return "debug";
}
