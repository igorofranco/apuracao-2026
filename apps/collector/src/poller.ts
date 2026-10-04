import { normalizeResultado } from "@apuracao/domain";
import { ELEICAO_2026 } from "@apuracao/shared";
import { JwsError, TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import { raceKey, type Target } from "./targets.ts";
import type { RaceStore } from "./store.ts";

export interface PollerStats {
  running: boolean;
  runs: number;
  lastRunAt: string | null;
  lastDurationMs: number;
  lastChanged: number;
  totalUpdates: number;
  failures: number;
  jwsFailures: number;
  notFound: number;
  lastError: string | null;
}

/** Janela em que a apuração costuma estar ativa (1º turno: 04/10, a partir das 17h BRT). */
function dentroDaApuracao(now = new Date()): boolean {
  const inicio = new Date(`${ELEICAO_2026.data}T17:00:00-03:00`).getTime();
  const fim = inicio + 12 * 60 * 60 * 1000; // ~12h de janela
  return now.getTime() >= inicio && now.getTime() <= fim;
}

export class Poller {
  readonly stats: PollerStats = {
    running: false,
    runs: 0,
    lastRunAt: null,
    lastDurationMs: 0,
    lastChanged: 0,
    totalUpdates: 0,
    failures: 0,
    jwsFailures: 0,
    notFound: 0,
    lastError: null,
  };

  private timer?: NodeJS.Timeout;
  private stopped = true;
  private readonly deps: {
    client: TseClient;
    store: RaceStore;
    targets: Target[];
    config: CollectorConfig;
  };

  constructor(deps: {
    client: TseClient;
    store: RaceStore;
    targets: Target[];
    config: CollectorConfig;
  }) {
    this.deps = deps;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.stats.running = true;
    if (this.deps.config.poll.runOnStart) {
      void this.loop();
    } else {
      this.schedule(this.deps.config.poll.activeMs);
    }
  }

  stop(): void {
    this.stopped = true;
    this.stats.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.loop(), ms);
  }

  private async loop(): Promise<void> {
    if (this.stopped) return;
    const changed = await this.runOnce();
    const active = changed > 0 || dentroDaApuracao();
    this.schedule(active ? this.deps.config.poll.activeMs : this.deps.config.poll.idleMs);
  }

  /** Executa uma rodada sobre todos os alvos e devolve o nº de corridas alteradas. */
  async runOnce(): Promise<number> {
    const started = Date.now();
    const { targets, config } = this.deps;
    let cursor = 0;
    let changed = 0;

    const worker = async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++] as Target;
        try {
          const raw = await this.deps.client.getResultado({
            ciclo: ELEICAO_2026.ciclo,
            cdEleicao: target.eleicao,
            cargo: target.cargo,
            uf: target.uf,
          });
          if (!raw) {
            this.stats.notFound += 1;
            continue;
          }
          const race = normalizeResultado(raw);
          const update = this.deps.store.setRace(race);
          if (update.changed) {
            changed += 1;
            this.stats.totalUpdates += 1;
          }
        } catch (err) {
          if (err instanceof JwsError) {
            this.stats.jwsFailures += 1;
            console.error(`[collector] assinatura inválida em ${raceKey(target)}:`, err.message);
            continue;
          }
          this.stats.failures += 1;
          this.stats.lastError = err instanceof Error ? err.message : String(err);
        }
      }
    };

    const workers = Array.from(
      { length: Math.max(1, Math.min(config.poll.concurrency, targets.length)) },
      () => worker(),
    );
    await Promise.all(workers);

    this.stats.runs += 1;
    this.stats.lastRunAt = new Date().toISOString();
    this.stats.lastDurationMs = Date.now() - started;
    this.stats.lastChanged = changed;
    if (changed > 0) {
      console.log(
        `[collector] rodada ${this.stats.runs}: ${changed} atualizações em ${this.stats.lastDurationMs}ms`,
      );
    }
    return changed;
  }
}
