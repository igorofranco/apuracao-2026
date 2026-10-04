import { EventEmitter } from "node:events";
import type { RaceResult, RaceSummary, Snapshot } from "@apuracao/domain";
import { raceKey, summarizeRace, snapshotFrom } from "@apuracao/domain";

export interface RaceUpdate {
  key: string;
  race: RaceResult;
  changed: boolean;
  at: string;
}

/** Persistência opcional de snapshots (Postgres). */
export interface SnapshotRepository {
  save(snapshot: Snapshot): void | Promise<void>;
  loadRecent(limit: number): Promise<Snapshot[]>;
  /** Série histórica por período (opcional). */
  history?(filter: {
    eleicao: number;
    cargo: number;
    uf: string;
    since?: string;
    limit: number;
  }): Promise<Snapshot[]>;
  /** Retenção: remove antigos (opcional). Retorna quantos foram removidos. */
  prune?(retentionDays: number): Promise<number>;
}

/** Assinatura curta para detectar mudança real em um resultado. */
function signature(race: RaceResult): string {
  const votos = race.candidatos.reduce((acc, c) => acc + c.votos, 0);
  return [
    race.geracao ?? "",
    race.totalizacaoFinal ? "1" : "0",
    race.secoes.totalizadas,
    race.eleitorado.apurado,
    race.votos.validos,
    votos,
    race.candidatos.length,
  ].join("|");
}

export class RaceStore extends EventEmitter {
  private readonly races = new Map<string, RaceResult>();
  private readonly signatures = new Map<string, string>();
  private readonly snapshots = new Map<string, Snapshot[]>();
  private readonly updatedAt = new Map<string, string>();
  private readonly options: { snapshotLimit: number; repo?: SnapshotRepository };

  constructor(options: { snapshotLimit: number; repo?: SnapshotRepository }) {
    super();
    this.options = options;
    this.setMaxListeners(0);
  }

  get size(): number {
    return this.races.size;
  }

  /** Carrega histórico persistido (chamado no boot, se houver Postgres). */
  async hydrate(): Promise<void> {
    if (!this.options.repo) return;
    const recent = await this.options.repo.loadRecent(this.options.snapshotLimit);
    for (const snap of recent) {
      const key = raceKey(snap);
      const list = this.snapshots.get(key) ?? [];
      list.push(snap);
      this.snapshots.set(key, list);
    }
  }

  setRace(race: RaceResult, at = new Date().toISOString()): RaceUpdate {
    const key = raceKey(race);
    const sig = signature(race);
    const changed = this.signatures.get(key) !== sig;
    this.races.set(key, race);
    this.signatures.set(key, sig);
    this.updatedAt.set(key, at);

    if (changed) {
      const snap = snapshotFrom(race, at);
      const list = this.snapshots.get(key) ?? [];
      list.push(snap);
      if (list.length > this.options.snapshotLimit) {
        list.splice(0, list.length - this.options.snapshotLimit);
      }
      this.snapshots.set(key, list);
      void this.options.repo?.save(snap);
    }

    const update: RaceUpdate = { key, race, changed, at };
    if (changed) this.emit("update", update);
    return update;
  }

  getRace(eleicao: number, cargo: number, uf: string): RaceResult | undefined {
    return this.races.get(raceKey({ eleicao, cargo, uf }));
  }

  listRaces(): RaceResult[] {
    return [...this.races.values()];
  }

  summaries(): RaceSummary[] {
    return this.listRaces().map(summarizeRace);
  }

  historico(eleicao: number, cargo: number, uf: string): Snapshot[] {
    return this.snapshots.get(raceKey({ eleicao, cargo, uf })) ?? [];
  }

  /**
   * Histórico de uma corrida: usa o Postgres quando disponível (mais completo,
   * sobrevive a restart) e cai para a memória como fallback.
   */
  async historicoAsync(
    eleicao: number,
    cargo: number,
    uf: string,
    options: { since?: string; limit: number; retentionDays: number },
  ): Promise<Snapshot[]> {
    const repo = this.options.repo;
    if (repo?.history) {
      try {
        const lista = await repo.history({
          eleicao,
          cargo,
          uf,
          since:
            options.since ??
            new Date(Date.now() - options.retentionDays * 86_400_000).toISOString(),
          limit: options.limit,
        });
        if (lista.length > 0) return lista;
      } catch {
        // cai para a memória
      }
    }
    return this.historico(eleicao, cargo, uf);
  }

  /** Executa a retenção no repositório (se suportado). Retorna removidos. */
  async prune(retentionDays: number): Promise<number> {
    if (!this.options.repo?.prune) return 0;
    return this.options.repo.prune(retentionDays);
  }

  /** Maior timestamp de atualização conhecido (para /status). */
  latestUpdate(): string | null {
    let max: string | null = null;
    for (const at of this.updatedAt.values()) {
      if (!max || at > max) max = at;
    }
    return max;
  }
}
