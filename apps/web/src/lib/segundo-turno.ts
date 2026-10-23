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

/**
 * De onde saiu a disputa exibida pelo destaque presidencial. Além das marcas de
 * 2º turno (`oficial`/`matematico`), `apuracao` representa a projeção com os
 * dois mais votados enquanto a definição ainda não foi publicada.
 */
export type OrigemDisputa = OrigemSegundoTurno | "apuracao";

export interface DisputaPresidencial {
  /** Os dois candidatos que disputam (ou disputarão) o 2º turno. */
  candidatos: CandidateResult[];
  origem: OrigemDisputa;
}

/**
 * Resolve os **dois** candidatos em evidência na disputa presidencial.
 *
 * - Se o TSE marcou os dois no 1º turno, usa a marca oficial.
 * - Se a eleição já é a do 2º turno, os dois classificados são a própria corrida.
 * - Senão, usa a projeção matemática; por último, os dois mais votados.
 */
export function disputaPresidencial(
  race: RaceResult | undefined | null,
): DisputaPresidencial | null {
  if (!race || race.candidatos.length === 0) return null;

  const definida = segundoTurnoDaCorrida(race);
  if (definida) return definida;

  const ordenados = [...race.candidatos].sort((a, b) => a.posicao - b.posicao);
  if (ordenados.length === 2) {
    return { candidatos: ordenados, origem: "oficial" };
  }

  const dois = ordenados.slice(0, 2);
  if (dois.length < 2 || dois.some((c) => c.votos <= 0)) return null;
  return { candidatos: dois, origem: "apuracao" };
}
