import { UF_SIGLAS, cargosDaUf, ELEICAO_2026 } from "@apuracao/shared";

export interface Target {
  eleicao: number;
  cargo: number;
  uf: string;
  /** Rótulo para logs. */
  label: string;
}

/**
 * Recursos que o coletor acompanha: Presidente (nacional) + cargos estaduais por
 * UF (Governador, Senador, Dep. Federal, Dep. Estadual/Distrital).
 */
export function buildTargets(): Target[] {
  const targets: Target[] = [];

  // Presidente (agregado Brasil).
  targets.push({
    eleicao: ELEICAO_2026.eleicoes.federal,
    cargo: 1,
    uf: "br",
    label: "Presidente (BR)",
  });

  // Cargos estaduais/distritais por UF.
  for (const uf of UF_SIGLAS) {
    for (const cargo of cargosDaUf(uf)) {
      targets.push({
        eleicao: ELEICAO_2026.eleicoes.estadual,
        cargo: cargo.codigo,
        uf,
        label: `${cargo.curto} (${uf.toUpperCase()})`,
      });
    }
  }

  return targets;
}

export const raceKey = (t: Pick<Target, "eleicao" | "cargo" | "uf">): string =>
  `${t.eleicao}:${t.cargo}:${t.uf}`;
