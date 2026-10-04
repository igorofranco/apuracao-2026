import type { Snapshot } from "@apuracao/domain";
import type { Logger } from "./logger.ts";
import type { SnapshotRepository } from "./store.ts";

export interface PostgresRepoOptions {
  connectionString: string;
  log: Logger;
}

function linhaParaSnapshot(r: Record<string, unknown>): Snapshot {
  return {
    eleicao: Number(r.eleicao),
    cargo: Number(r.cargo),
    uf: String(r.uf),
    geracao: (r.geracao as string | null) ?? null,
    capturadoEm: new Date(r.capturado_em as string).toISOString(),
    percentualApurado: Number(r.percentual_apurado ?? 0),
    votosValidos: Number(r.votos_validos ?? 0),
    lider: (r.lider as Snapshot["lider"]) ?? null,
  };
}

/**
 * Repositório de snapshots em Postgres. Criado apenas quando `DATABASE_URL`
 * está definido. Erros de persistência não derrubam o coletor.
 */
export async function createPostgresRepo(
  options: PostgresRepoOptions,
): Promise<SnapshotRepository> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: options.connectionString, max: 4 });
  pool.on("error", (err) => {
    options.log.error("erro no pool do Postgres", { erro: err.message });
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id BIGSERIAL PRIMARY KEY,
      eleicao INTEGER NOT NULL,
      cargo INTEGER NOT NULL,
      uf TEXT NOT NULL,
      geracao TEXT,
      capturado_em TIMESTAMPTZ NOT NULL,
      percentual_apurado NUMERIC,
      votos_validos BIGINT,
      lider JSONB
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS snapshots_race_idx
      ON snapshots (eleicao, cargo, uf, capturado_em DESC);
  `);

  return {
    async save(s: Snapshot) {
      try {
        await pool.query(
          `INSERT INTO snapshots
            (eleicao, cargo, uf, geracao, capturado_em, percentual_apurado, votos_validos, lider)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            s.eleicao,
            s.cargo,
            s.uf,
            s.geracao,
            s.capturadoEm,
            s.percentualApurado,
            s.votosValidos,
            s.lider ? JSON.stringify(s.lider) : null,
          ],
        );
      } catch (err) {
        options.log.error("falha ao persistir snapshot", {
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    },

    /** Último snapshot de cada corrida (usado para hidratar a memória no boot). */
    async loadRecent(limit: number): Promise<Snapshot[]> {
      const { rows } = await pool.query(
        `SELECT * FROM (
           SELECT DISTINCT ON (eleicao, cargo, uf) *
           FROM snapshots
           ORDER BY eleicao, cargo, uf, capturado_em DESC
         ) t ORDER BY capturado_em DESC LIMIT $1`,
        [limit],
      );
      return rows.map(linhaParaSnapshot);
    },

    /** Série histórica de uma corrida dentro da janela de retenção. */
    async history(filter: {
      eleicao: number;
      cargo: number;
      uf: string;
      since?: string;
      limit: number;
    }): Promise<Snapshot[]> {
      const { rows } = await pool.query(
        `SELECT * FROM snapshots
          WHERE eleicao = $1 AND cargo = $2 AND uf = $3
            AND ($4::timestamptz IS NULL OR capturado_em >= $4::timestamptz)
          ORDER BY capturado_em ASC
          LIMIT $5`,
        [filter.eleicao, filter.cargo, filter.uf, filter.since ?? null, filter.limit],
      );
      return rows.map(linhaParaSnapshot);
    },

    /** Remove snapshots mais antigos que a retenção. Retorna quantos saíram. */
    async prune(retentionDays: number): Promise<number> {
      const { rowCount } = await pool.query(
        `DELETE FROM snapshots
          WHERE capturado_em < now() - make_interval(days => $1::int)`,
        [retentionDays],
      );
      return rowCount ?? 0;
    },
  };
}
