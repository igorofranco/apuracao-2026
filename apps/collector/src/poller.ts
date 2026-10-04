import { normalizeResultado, raceKey } from "@apuracao/domain";
import { JwsError, TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import { estaEmApuracao, type EleicoesResolvidas } from "./eleicoes.ts";
import type { Logger } from "./logger.ts";
import type { Target } from "./targets.ts";
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
  consecutiveFailures: number;
  backoffMs: number;
  lastError: string | null;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PollerDeps {
  client: TseClient;
  store: RaceStore;
  targets: Target[];
  eleicoes: EleicoesResolvidas;
  config: CollectorConfig;
  log: Logger;
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
    consecutiveFailures: 0,
    backoffMs: 0,
    lastError: null,
  };

  private timer?: NodeJS.Timeout;
  private stopped = true;
  private readonly deps: PollerDeps;

  constructor(deps: PollerDeps) {
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
    this.stats.backoffMs = ms;
    this.timer = setTimeout(() => void this.loop(), ms);
  }

  private async loop(): Promise<void> {
    if (this.stopped) return;
    const { changed, failures } = await this.runOnce();
    const { activeMs, idleMs, maxBackoffMs } = this.deps.config.poll;
    const base = changed > 0 || estaEmApuracao(this.deps.eleicoes) ? activeMs : idleMs;

    // Backoff exponencial quando nada muda e há falhas (ex.: TSE indisponível),
    // evitando martelar a fonte. Volta ao normal assim que houver sucesso.
    if (failures > 0 && changed === 0) {
      this.stats.consecutiveFailures += 1;
      const potencial = Math.max(base, this.stats.backoffMs || base) * 2;
      this.schedule(Math.min(potencial, maxBackoffMs));
    } else {
      this.stats.consecutiveFailures = 0;
      this.schedule(base);
    }
  }

  /** Busca um alvo com retry leve. Retorna null em 404 (sem dados). */
  private async buscar(target: Target): Promise<ReturnType<typeof normalizeResultado> | null> {
    const tentativas = Math.max(1, this.deps.config.poll.retries);
    let ultimoErro: unknown;
    for (let i = 0; i < tentativas; i++) {
      try {
        const raw = await this.deps.client.getResultado({
          ciclo: this.deps.eleicoes.ciclo,
          cdEleicao: target.eleicao,
          cargo: target.cargo,
          uf: target.uf,
        });
        return raw ? normalizeResultado(raw) : null;
      } catch (err) {
        if (err instanceof JwsError) throw err; // integridade: não insiste
        ultimoErro = err;
        if (i < tentativas - 1) await dormir(200 * (i + 1) + Math.random() * 100);
      }
    }
    throw ultimoErro;
  }

  /** Executa uma rodada sobre todos os alvos. */
  async runOnce(): Promise<{ changed: number; failures: number }> {
    const started = Date.now();
    const { targets, config, log } = this.deps;
    let cursor = 0;
    let changed = 0;
    let failures = 0;

    const worker = async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++] as Target;
        try {
          const race = await this.buscar(target);
          if (!race) {
            this.stats.notFound += 1;
            continue;
          }
          const update = this.deps.store.setRace(race);
          if (update.changed) {
            changed += 1;
            this.stats.totalUpdates += 1;
          }
        } catch (err) {
          if (err instanceof JwsError) {
            this.stats.jwsFailures += 1;
            log.error("assinatura JWS inválida", { corrida: raceKey(target), erro: err.message });
            continue;
          }
          failures += 1;
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
      log.info("rodada com atualizações", {
        rodada: this.stats.runs,
        atualizacoes: changed,
        ms: this.stats.lastDurationMs,
      });
    } else if (failures > 0) {
      log.warn("rodada com falhas", { rodada: this.stats.runs, falhas: failures });
    }
    return { changed, failures };
  }
}
