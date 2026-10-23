import { describe, expect, it } from "vitest";
import type { CandidateResult, RaceResult } from "@apuracao/domain";
import {
  CANDIDATOS_PRESIDENCIA_2026,
  disputaPresidencial,
  disputaPresidencialComFallback,
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

describe("disputaPresidencial", () => {
  it("usa a corrida do 2º turno quando ela já tem dois candidatos", () => {
    const r = race(1, [cand("13", { votos: 60 }), cand("22", { votos: 50 })]);
    const disputa = disputaPresidencial(r);
    expect(disputa?.origem).toBe("oficial");
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
  });

  it("cai para os dois mais votados enquanto não há definição", () => {
    const r = race(1, [
      cand("1", { votos: 40, posicao: 1 }),
      cand("2", { votos: 30, posicao: 2 }),
      cand("3", { votos: 10, posicao: 3 }),
    ]);
    const disputa = disputaPresidencial(r);
    expect(disputa?.origem).toBe("apuracao");
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["1", "2"]);
  });

  it("não destaca ninguém antes de existir voto", () => {
    const r = race(1, [cand("1"), cand("2"), cand("3")]);
    expect(disputaPresidencial(r)).toBeNull();
    expect(disputaPresidencial(null)).toBeNull();
  });
});

describe("disputaPresidencialComFallback", () => {
  it("mostra a dupla do 2º turno mesmo sem corrida publicada", () => {
    const disputa = disputaPresidencialComFallback(null, 2);
    expect(disputa?.origem).toBe("aguardando");
    expect(disputa?.candidatos).toHaveLength(2);
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["22", "13"]);
    expect(disputa?.candidatos.map((c) => c.nomeUrna)).toEqual([
      "FLAVIO BOLSONARO",
      "LULA",
    ]);
    expect(disputa?.candidatos.every((c) => c.sqcand)).toBe(true);
    expect(
      disputa?.candidatos.every((c) => c.votos === 0 && c.percentual === 0),
    ).toBe(true);
  });

  it("não usa o fallback no 1º turno", () => {
    expect(disputaPresidencialComFallback(null, 1)).toBeNull();
  });

  it("prefere a corrida real quando ela já tem os dois candidatos", () => {
    const real = race(1, [cand("13", { votos: 60 }), cand("22", { votos: 50 })]);
    const disputa = disputaPresidencialComFallback(real, 2);
    expect(disputa?.origem).toBe("oficial");
    expect(disputa?.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
    expect(disputa?.candidatos).not.toBe(CANDIDATOS_PRESIDENCIA_2026);
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
