import { UF_SIGLAS, cargosDaUf } from "@apuracao/shared";
import type { EleicoesResolvidas } from "./eleicoes.ts";

export interface Target {
  eleicao: number;
  cargo: number;
  uf: string;
  /** Rótulo para logs. */
  label: string;
}

/**
 * Recursos que o coletor acompanha: Presidente (nacional) + cargos estaduais por
 * UF (Governador, Senador, Dep. Federal, Dep. Estadual/Distrital). Os códigos de
 * eleição vêm das eleições resolvidas (cobre 2º turno automaticamente).
 */
export function buildTargets(eleicoes: EleicoesResolvidas): Target[] {
  const targets: Target[] = [];

  targets.push({
    eleicao: eleicoes.federal.cd,
    cargo: 1,
    uf: "br",
    label: "Presidente (BR)",
  });

  for (const uf of UF_SIGLAS) {
    for (const cargo of cargosDaUf(uf)) {
      targets.push({
        eleicao: eleicoes.estadual.cd,
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
