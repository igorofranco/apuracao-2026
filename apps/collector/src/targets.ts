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
 * UF (Governador, Senador, Dep. Federal, Dep. Estadual/Distrital).
 *
 * No 2º turno, só Presidente e Governador voltam às urnas. Os demais cargos
 * (Senador e Deputados) foram decididos no 1º turno e continuam sendo coletados
 * a partir da eleição anterior — assim os dados não desaparecem do painel.
 */
export function buildTargets(eleicoes: EleicoesResolvidas): Target[] {
  const targets: Target[] = [];
  const primeiroEstadual = eleicoes.primeiroTurno?.estadual;

  targets.push({
    eleicao: eleicoes.federal.cd,
    cargo: 1,
    uf: "br",
    label: "Presidente (BR)",
  });

  for (const uf of UF_SIGLAS) {
    for (const cargo of cargosDaUf(uf)) {
      if (
        cargo.codigo === 3 &&
        primeiroEstadual &&
        primeiroEstadual.cd !== eleicoes.estadual.cd
      ) {
        // Governador no 2º turno + 1º turno como fallback: só alguns estados
        // têm disputa no 2º turno, e os demais seguem com o resultado anterior.
        targets.push({
          eleicao: eleicoes.estadual.cd,
          cargo: cargo.codigo,
          uf,
          label: `${cargo.curto} (${uf.toUpperCase()}) · 2º turno`,
        });
        targets.push({
          eleicao: primeiroEstadual.cd,
          cargo: cargo.codigo,
          uf,
          label: `${cargo.curto} (${uf.toUpperCase()}) · 1º turno`,
        });
        continue;
      }

      // Senador/Deputados seguem no 1º turno (onde a vaga foi decidida).
      const turnoAtual = !primeiroEstadual;
      targets.push({
        eleicao: turnoAtual ? eleicoes.estadual.cd : primeiroEstadual.cd,
        cargo: cargo.codigo,
        uf,
        label: `${cargo.curto} (${uf.toUpperCase()})`,
      });
    }
  }

  return targets;
}
