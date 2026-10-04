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
  /**
   * Números dos candidatos garantidos no 2º turno (só cargos majoritários de
   * vaga única: Presidente e Governador). Vazio quando o cargo não tem 2º
   * turno, quando o pleito já está decidido no 1º turno ou quando ninguém está
   * garantido ainda. Pode ter um ou dois nomes.
   */
  numerosSegundoTurno: string[];
}

const INDISPONIVEL: EleicaoMatematicaResultado = {
  estado: "indisponivel",
  vagas: 0,
  votosValidosProjetados: 0,
  numeros: [],
  numerosSegundoTurno: [],
};

/**
 * Detecta a marca oficial de 2º turno na situação textual publicada pelo TSE
 * (campo `st`, ex.: "2º turno"). Tolera variações de acento, caixa e ordinal.
 */
export function ehSegundoTurnoOficial(
  situacao: string | null | undefined,
): boolean {
  if (!situacao) return false;
  const limpa = situacao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "o")
    .replace(/\s+/g, " ")
    .trim();
  return (
    limpa.includes("2o turno") ||
    limpa.includes("2 turno") ||
    limpa.includes("segundo turno")
  );
}

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
 * Regras por tipo de cargo:
 * - **Vaga única** (Presidente/Governador): elege quem tiver a maioria absoluta
 *   dos votos válidos. Sem maioria garantida, calculamos também quem já está
 *   garantido no **2º turno** (os dois mais votados avançam): o 3º colocado, que
 *   no pior cenário recebe todos os votos restantes, não pode alcançá-lo.
 * - **Duas vagas** (Senador): os dois primeiros estão eleitos se o 3º não os
 *   alcançar; não há 2º turno para este cargo.
 *
 * Ex.: `vagas = 1` → maioria garantida se `votos[0] > totalProjetado / 2`; o
 * 2º turno do líder fica garantido se `votos[2] + restantes < votos[0]`.
 * `vagas = 2` → o 2º colocado está seguro se `votos[2] + restantes < votos[1]`.
 */
export function computeEleicaoMatematica(
  race: RaceResult | undefined | null,
): EleicaoMatematicaResultado {
  if (!race || race.candidatos.length === 0) return INDISPONIVEL;
  if (race.totalizacaoFinal) {
    return {
      estado: "final",
      vagas: 0,
      votosValidosProjetados: race.votos.validos,
      numeros: [],
      numerosSegundoTurno: [],
    };
  }

  const cargo = getCargo(race.cargo);
  // Só cargos majoritários têm vagas fixas; proporcionais dependem do quociente.
  if (!cargo?.majoritario || !cargo.vagas) {
    return {
      estado: "proporcional",
      vagas: 0,
      votosValidosProjetados: race.votos.validos,
      numeros: [],
      numerosSegundoTurno: [],
    };
  }

  const vagas = cargo.vagas;
  const votos = race.candidatos.map((c) => c.votos);
  const maxVotos = Math.max(...votos);
  if (maxVotos <= 0) {
    return {
      estado: "aguardando",
      vagas,
      votosValidosProjetados: race.votos.validos,
      numeros: [],
      numerosSegundoTurno: [],
    };
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

  const numeros: string[] = [];
  const numerosSegundoTurno: string[] = [];

  if (vagas === 1) {
    // Vaga única: a eleição no 1º turno exige maioria absoluta. Como o líder não
    // recebe votos novos, ele está eleito quando seu total supera a metade do
    // total projetado de válidos (nenhum adversário chega perto).
    const lider = votos[0] as number;
    if (lider > 0 && lider > totalProjetado / 2) {
      numeros.push(race.candidatos[0]!.numero);
    } else {
      // Sem maioria garantida, os dois mais votados vão ao 2º turno. O único
      // adversário capaz de dar o salto é o 3º colocado (absorve todos os votos
      // restantes no pior cenário); quem o supera já está no 2º turno.
      const tetoSegundoTurno = (votos[2] ?? 0) + restantes;
      const limite = Math.min(2, votos.length);
      for (let p = 0; p < limite; p++) {
        const v = votos[p] as number;
        if (v > 0 && v > tetoSegundoTurno) {
          const numero = race.candidatos[p]!.numero;
          if (!numerosSegundoTurno.includes(numero)) numerosSegundoTurno.push(numero);
        }
      }
    }
  } else {
    // Mais de uma vaga (Senador): o primeiro abaixo da linha de corte
    // (`votos[vagas]`) é o melhor adversário; basta comparar o teto dele com
    // cada candidato dentro das vagas.
    const adversario = votos[vagas] ?? 0;
    const tetoAdversario = adversario + restantes;
    const dentro = Math.min(vagas, votos.length);
    for (let p = 0; p < dentro; p++) {
      const v = votos[p] as number;
      if (v > 0 && v > tetoAdversario) {
        for (const c of race.candidatos) {
          if (c.votos === v && !numeros.includes(c.numero)) numeros.push(c.numero);
        }
      }
    }
  }

  return {
    estado: numeros.length > 0 ? "parcial" : "indefinido",
    vagas,
    votosValidosProjetados: totalProjetado,
    numeros,
    numerosSegundoTurno,
  };
}

/**
 * Cópia de `race` com `matematicamenteEleito` e `matematicamenteSegundoTurno`
 * derivados do cálculo. Candidatos já eleitos oficialmente nunca são marcados
 * (a marca do TSE prevalece).
 */
export function withEleicaoMatematica(race: RaceResult): RaceResult {
  const { numeros, numerosSegundoTurno } = computeEleicaoMatematica(race);
  const eleitos = new Set(numeros);
  const segundo = new Set(numerosSegundoTurno);
  let mudou = false;
  const candidatos: CandidateResult[] = race.candidatos.map((c) => {
    const matematicamenteEleito = !c.eleito && eleitos.has(c.numero);
    const matematicamenteSegundoTurno = !c.eleito && segundo.has(c.numero);
    if (
      c.matematicamenteEleito === matematicamenteEleito &&
      c.matematicamenteSegundoTurno === matematicamenteSegundoTurno
    ) {
      return c;
    }
    mudou = true;
    return { ...c, matematicamenteEleito, matematicamenteSegundoTurno };
  });
  return mudou ? { ...race, candidatos } : race;
}
