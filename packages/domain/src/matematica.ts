import { getCargo } from "@apuracao/shared";
import type { CandidateResult, RaceResult } from "./types.ts";

export type EleicaoMatematica =
  /** Sem resultado (corrida não encontrada ou sem candidatos). */
  | "indisponivel"
  /** Totalização oficial encerrada: o cálculo matemático não se aplica. */
  | "final"
  /** Apuração ainda não iniciada (nenhum voto computado). */
  | "aguardando"
  /** Cargo proporcional: depende do quociente eleitoral, não projetamos. */
  | "proporcional"
  /** Ainda não há como garantir a eleição de nenhum candidato. */
  | "indefinido"
  /** Um subconjunto de candidatos já está matematicamente eleito. */
  | "parcial";

/**
 * Fração dos votos de uma seção que são válidos (exclui brancos/nulos). É a
 * constante de fallback; quando a corrida já traz brancos/nulos computados,
 * derivamos a fração real dos dados.
 */
const FRACAO_VALIDOS = 0.86;

export interface EleicaoMatematicaResultado {
  estado: EleicaoMatematica;
  /** Quantidade de vagas usadas no cálculo (fixa para majoritários). */
  vagas: number;
  /** Projeção do total de votos válidos ao fim da apuração. */
  votosValidosProjetados: number;
  /** Números dos candidatos considerados matematicamente eleitos. */
  numeros: string[];
}

const INDISPONIVEL: EleicaoMatematicaResultado = {
  estado: "indisponivel",
  vagas: 0,
  votosValidosProjetados: 0,
  numeros: [],
};

/**
 * Projeta a eleição matemática de um cargo majoritário.
 *
 * A tese é conservadora para o candidato: ele **não** recebe nenhum voto novo.
 *
 * - `restantes` é a projeção dos votos válidos que ainda entram nas seções não
 *   apuradas (aproximada por `FRACAO_VALIDOS`, já que o TSE não publica a
 *   composição isolada das seções pendentes).
 * - O melhor adversário por fora das vagas recebe **todos** esses votos (é o
 *   único que pode dar um salto), originando `tetoAdversario`.
 * - Um candidato dentro das vagas está garantido quando seu total supera esse
 *   teto, mesmo nesse pior cenário.
 *
 * Ex.: `vagas = 1` → o 1º colocado está seguro se `votos[1] + restantes < votos[0]`.
 * `vagas = 2` (Senador) → o 2º colocado está seguro se `votos[2] + restantes < votos[1]`
 * (e o 1º, se `votos[2] + restantes < votos[0]`).
 *
 * Retorna os números dos candidatos garantidos; para vagas > 1 pode haver mais
 * de um.
 */
export function computeEleicaoMatematica(
  race: RaceResult | undefined | null,
): EleicaoMatematicaResultado {
  if (!race || race.candidatos.length === 0) return INDISPONIVEL;
  if (race.totalizacaoFinal) {
    return { estado: "final", vagas: 0, votosValidosProjetados: race.votos.validos, numeros: [] };
  }

  const cargo = getCargo(race.cargo);
  // Só cargos majoritários têm vagas fixas; proporcionais dependem do quociente.
  if (!cargo?.majoritario || !cargo.vagas) {
    return { estado: "proporcional", vagas: 0, votosValidosProjetados: race.votos.validos, numeros: [] };
  }

  const vagas = cargo.vagas;
  const votos = race.candidatos.map((c) => c.votos);
  const maxVotos = Math.max(...votos);
  if (maxVotos <= 0) {
    return { estado: "aguardando", vagas, votosValidosProjetados: race.votos.validos, numeros: [] };
  }

  const secoes = race.secoes;
  const faltam = Math.max(
    0,
    secoes.total > 0 ? secoes.total - secoes.totalizadas : secoes.naoApuradas,
  );
  const votosPorSecao = secoes.totalizadas > 0 ? race.votos.validos / secoes.totalizadas : 0;
  // Fração de votos válidos observada na apuração até agora (brancos/nulos
  // contam contra). Cai para a constante quando ainda não há dados.
  const totalComputado = race.votos.validos + race.votos.brancos + race.votos.nulos;
  const fracaoValidos =
    totalComputado > 0 ? race.votos.validos / totalComputado : FRACAO_VALIDOS;
  const restantes = Math.max(0, Math.round(faltam * votosPorSecao * fracaoValidos));
  const totalProjetado = race.votos.validos + restantes;

  // Um candidato já eleito (posição p < vagas) está garantido quando o melhor
  // adversário por fora — que no pior cenário absorve **todos** os votos válidos
  // ainda não apurados — ainda fica abaixo dele. O adversário é o primeiro
  // abaixo da linha de corte (`votos[vagas]`); só um adversário pode dar o salto,
  // então basta comparar o teto dele com cada candidato dentro das vagas.
  const adversario = votos[vagas] ?? 0;
  const tetoAdversario = adversario + restantes;

  const numeros: string[] = [];
  const dentro = Math.min(vagas, votos.length);
  for (let p = 0; p < dentro; p++) {
    const v = votos[p] as number;
    if (v > 0 && v > tetoAdversario) {
      for (const c of race.candidatos) {
        if (c.votos === v && !numeros.includes(c.numero)) numeros.push(c.numero);
      }
    }
  }

  return {
    estado: numeros.length > 0 ? "parcial" : "indefinido",
    vagas,
    votosValidosProjetados: totalProjetado,
    numeros,
  };
}

/** Cópia de `race` com `matematicamenteEleito` derivado do cálculo. */
export function withEleicaoMatematica(race: RaceResult): RaceResult {
  const { numeros } = computeEleicaoMatematica(race);
  if (numeros.length === 0) return race;
  const conjunto = new Set(numeros);
  const candidatos: CandidateResult[] = race.candidatos.map((c) =>
    conjunto.has(c.numero) && !c.eleito ? { ...c, matematicamenteEleito: true } : c,
  );
  return { ...race, candidatos };
}
