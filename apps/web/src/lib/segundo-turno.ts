import type { CandidateResult, RaceResult } from "@apuracao/domain";
import { getCargo } from "@apuracao/shared";

/** De onde veio a definição dos dois que disputam o 2º turno. */
export type OrigemSegundoTurno = "oficial" | "matematico";

export interface SegundoTurno {
  /** Os dois candidatos que vão ao 2º turno, na ordem de colocação. */
  candidatos: CandidateResult[];
  /**
   * `oficial` quando o TSE já marcou a situação dos candidatos; `matematico`
   * quando é projeção (não podem mais ser ultrapassados pelo 3º colocado).
   */
  origem: OrigemSegundoTurno;
}

/**
 * Cargos majoritários de vaga única (Presidente, Governador) só decidem em 1º
 * turno com maioria absoluta; caso contrário, os dois mais votados disputam o
 * 2º turno. Senador (2 vagas) e proporcionais não têm 2º turno.
 */
export function temSegundoTurno(cargoCodigo: number | string): boolean {
  const cargo = getCargo(cargoCodigo);
  return Boolean(cargo?.majoritario && cargo.vagas === 1);
}

/**
 * Resolve a disputa de 2º turno de uma corrida, dando prioridade à marca oficial
 * do TSE sobre a projeção matemática. Retorna `null` quando o cargo não tem 2º
 * turno ou quando os dois ainda não estão definidos.
 */
export function segundoTurnoDaCorrida(
  race: RaceResult | undefined | null,
): SegundoTurno | null {
  if (!race || !temSegundoTurno(race.cargo)) return null;

  const oficiais = race.candidatos.filter((c) => c.segundoTurnoOficial);
  if (oficiais.length >= 2) {
    return { candidatos: oficiais.slice(0, 2), origem: "oficial" };
  }

  const matematicos = race.candidatos.filter((c) => c.matematicamenteSegundoTurno);
  if (matematicos.length >= 2) {
    return { candidatos: matematicos.slice(0, 2), origem: "matematico" };
  }

  return null;
}

/**
 * Origem do 2º turno para um candidato isolado. Útil para realçar quem já está
 * garantido mesmo quando o outro nome da disputa ainda não está definido.
 */
export function origemSegundoTurnoCandidato(
  candidato: CandidateResult,
): OrigemSegundoTurno | null {
  if (candidato.segundoTurnoOficial) return "oficial";
  if (candidato.matematicamenteSegundoTurno) return "matematico";
  return null;
}
