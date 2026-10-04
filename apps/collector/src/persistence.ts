import type { Snapshot } from "@apuracao/domain";
import type { SnapshotRepository } from "./store.ts";

/**
 * Repositório de snapshots em Postgres (opcional). Criado apenas quando
 * `DATABASE_URL` está definido. Erros de persistência não derrubam o coletor.
 */
export async function createPostgresRepo(
  connectionString: string,
): Promise<SnapshotRepository> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 4 });

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
        console.error("[collector] falha ao persistir snapshot:", err);
      }
    },

    async loadRecent(limit: number): Promise<Snapshot[]> {
      const { rows } = await pool.query(
        `SELECT * FROM (
           SELECT DISTINCT ON (eleicao, cargo, uf) *
           FROM snapshots
           ORDER BY eleicao, cargo, uf, capturado_em DESC
         ) t ORDER BY capturado_em DESC LIMIT $1`,
        [limit],
      );
      return rows.map((r) => ({
        eleicao: r.eleicao,
        cargo: r.cargo,
        uf: r.uf,
        geracao: r.geracao ?? null,
        capturadoEm: new Date(r.capturado_em).toISOString(),
        percentualApurado: Number(r.percentual_apurado ?? 0),
        votosValidos: Number(r.votos_validos ?? 0),
        lider: r.lider ?? null,
      }));
    },
  };
}
