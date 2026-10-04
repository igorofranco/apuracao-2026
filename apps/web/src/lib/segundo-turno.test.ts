import { describe, expect, it } from "vitest";
import type { CandidateResult, RaceResult } from "@apuracao/domain";
import {
  origemSegundoTurnoCandidato,
  segundoTurnoDaCorrida,
  temSegundoTurno,
} from "./segundo-turno";

function cand(numero: string, extra: Partial<CandidateResult> = {}): CandidateResult {
  return {
    numero,
    sqcand: null,
    nome: `Candidato ${numero}`,
    nomeUrna: `CANDIDATO ${numero}`,
    partido: "PARTIDO",
    siglaPartido: "PT",
    federacao: null,
    coligacao: null,
    composicao: null,
    votos: 0,
    percentual: 0,
    posicao: Number(numero),
    eleito: false,
    matematicamenteEleito: false,
    matematicamenteSegundoTurno: false,
    segundoTurnoOficial: false,
    situacao: null,
    vice: null,
    suplentes: [],
    ...extra,
  };
}

function race(cargo: number, candidatos: CandidateResult[]): RaceResult {
  return {
    eleicao: 6259,
    cargo,
    uf: "sp",
    abrangencia: "uf",
    geracao: "1",
    atualizadoEm: null,
    andamento: "s",
    totalizacaoFinal: false,
    divulgarVotacao: true,
    secoes: {
      total: 100,
      totalizadas: 100,
      naoTotalizadas: 0,
      instaladas: 100,
      naoInstaladas: 0,
      apuradas: 100,
      naoApuradas: 0,
      percentualTotalizadas: 100,
      percentualApuradas: 100,
    },
    eleitorado: {
      total: 0,
      apurado: 0,
      naoApurado: 0,
      percentualApurado: 0,
      comparecimento: 0,
      percentualComparecimento: 0,
      abstencoes: 0,
      percentualAbstencoes: 0,
    },
    votos: {
      validos: 0,
      nominal: 0,
      legenda: 0,
      brancos: 0,
      nulos: 0,
      nulosTotal: 0,
      anulados: 0,
      votaveisConcorrentes: 0,
    },
    candidatos,
  };
}

describe("temSegundoTurno", () => {
  it("só para cargos majoritários de vaga única", () => {
    expect(temSegundoTurno(1)).toBe(true); // Presidente
    expect(temSegundoTurno(3)).toBe(true); // Governador
    expect(temSegundoTurno(5)).toBe(false); // Senador (2 vagas)
    expect(temSegundoTurno(6)).toBe(false); // proporcional
  });
});

describe("segundoTurnoDaCorrida", () => {
  it("retorna null para cargo sem 2º turno", () => {
    const r = race(5, [cand("1", { matematicamenteSegundoTurno: true })]);
    expect(segundoTurnoDaCorrida(r)).toBeNull();
  });

  it("retorna null quando menos de dois estão definidos", () => {
    const r = race(3, [cand("1", { matematicamenteSegundoTurno: true }), cand("2")]);
    expect(segundoTurnoDaCorrida(r)).toBeNull();
  });

  it("resolve a projeção matemática com dois candidatos", () => {
    const r = race(3, [
      cand("1", { matematicamenteSegundoTurno: true }),
      cand("2", { matematicamenteSegundoTurno: true }),
      cand("3"),
    ]);
    const disputa = segundoTurnoDaCorrida(r);
    expect(disputa?.origem).toBe("matematico");
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["1", "2"]);
  });

  it("dá prioridade à marca oficial do TSE", () => {
    const r = race(1, [
      cand("1", { segundoTurnoOficial: true, matematicamenteSegundoTurno: true }),
      cand("2", { segundoTurnoOficial: true }),
      cand("3", { matematicamenteSegundoTurno: true }),
    ]);
    const disputa = segundoTurnoDaCorrida(r);
    expect(disputa?.origem).toBe("oficial");
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["1", "2"]);
  });
});

describe("origemSegundoTurnoCandidato", () => {
  it("prefere oficial e cai para matemático", () => {
    expect(origemSegundoTurnoCandidato(cand("1", { segundoTurnoOficial: true }))).toBe(
      "oficial",
    );
    expect(
      origemSegundoTurnoCandidato(cand("2", { matematicamenteSegundoTurno: true })),
    ).toBe("matematico");
    expect(origemSegundoTurnoCandidato(cand("3"))).toBeNull();
  });
});
