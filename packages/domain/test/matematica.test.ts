import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeEleicaoMatematica,
  normalizeResultado,
  withEleicaoMatematica,
  type RaceResult,
} from "../src/index.ts";

const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

interface Cenario {
  cargo: number;
  votos: number[];
  secoesTotal: number;
  secoesTotalizadas: number;
  validos: number;
  eleitos?: number[];
  final?: boolean;
}

/** Monta uma corrida mínima, já ordenada como `normalizeResultado` faria. */
function corrida(c: Cenario): RaceResult {
  const candidatos = c.votos
    .map((votos, i) => ({ votos, numero: String(i + 1), eleito: (c.eleitos ?? []).includes(i + 1) }))
    .sort((a, b) => b.votos - a.votos)
    .map((x, i) => ({
      numero: x.numero,
      sqcand: null,
      nome: `Candidato ${x.numero}`,
      nomeUrna: `CANDIDATO ${x.numero}`,
      partido: "PARTIDO",
      siglaPartido: "PT",
      federacao: null,
      coligacao: null,
      composicao: null,
      votos: x.votos,
      percentual: 0,
      posicao: i + 1,
      eleito: x.eleito,
      matematicamenteEleito: false,
      situacao: null,
      vice: null,
      suplentes: [],
    }));

  return {
    eleicao: 6259,
    cargo: c.cargo,
    uf: "sp",
    abrangencia: "uf",
    geracao: "1",
    atualizadoEm: "2026-10-04T18:00:00-03:00",
    andamento: "s",
    totalizacaoFinal: c.final ?? false,
    divulgarVotacao: true,
    secoes: {
      total: c.secoesTotal,
      totalizadas: c.secoesTotalizadas,
      naoTotalizadas: c.secoesTotal - c.secoesTotalizadas,
      instaladas: c.secoesTotal,
      naoInstaladas: 0,
      apuradas: c.secoesTotalizadas,
      naoApuradas: c.secoesTotal - c.secoesTotalizadas,
      percentualTotalizadas: (c.secoesTotalizadas / c.secoesTotal) * 100,
      percentualApuradas: (c.secoesTotalizadas / c.secoesTotal) * 100,
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
      validos: c.validos,
      nominal: c.validos,
      legenda: 0,
      brancos: 0,
      nulos: 0,
      nulosTotal: 0,
      anulados: 0,
      votaveisConcorrentes: c.validos,
    },
    candidatos,
  };
}

describe("computeEleicaoMatematica", () => {
  it("retorna indisponível sem corrida ou sem candidatos", () => {
    expect(computeEleicaoMatematica(undefined).estado).toBe("indisponivel");
    expect(
      computeEleicaoMatematica(corrida({ cargo: 3, votos: [], secoesTotal: 10, secoesTotalizadas: 5, validos: 0 }))
        .estado,
    ).toBe("indisponivel");
  });

  it("não calcula para cargos proporcionais (quociente eleitoral)", () => {
    const r = computeEleicaoMatematica(
      corrida({ cargo: 6, votos: [1000, 900, 800], secoesTotal: 100, secoesTotalizadas: 90, validos: 2700 }),
    );
    expect(r.estado).toBe("proporcional");
    expect(r.numeros).toEqual([]);
  });

  it("não se aplica após a totalização final", () => {
    const r = computeEleicaoMatematica(
      corrida({ cargo: 3, votos: [100, 90], secoesTotal: 100, secoesTotalizadas: 100, validos: 190, final: true }),
    );
    expect(r.estado).toBe("final");
  });

  it("aguarda quando ainda não há votos", () => {
    const r = computeEleicaoMatematica(
      corrida({ cargo: 3, votos: [0, 0, 0], secoesTotal: 100, secoesTotalizadas: 0, validos: 0 }),
    );
    expect(r.estado).toBe("aguardando");
  });

  it("Governador: líder folgado é eleito mesmo sem seções apuradas", () => {
    const r = computeEleicaoMatematica(
      corrida({
        cargo: 3,
        votos: [1000, 200, 50],
        secoesTotal: 1000,
        secoesTotalizadas: 990,
        validos: 1250,
      }),
    );
    expect(r.estado).toBe("parcial");
    expect(r.numeros).toEqual(["1"]);
    expect(r.votosValidosProjetados).toBeGreaterThan(1250);
  });

  it("Governador: corrida apertada não define eleito", () => {
    const r = computeEleicaoMatematica(
      corrida({
        cargo: 3,
        votos: [1000, 990, 0],
        secoesTotal: 1000,
        secoesTotalizadas: 990,
        validos: 1990,
      }),
    );
    expect(r.estado).toBe("indefinido");
    expect(r.numeros).toEqual([]);
  });

  it("Senador (2 vagas): marca os dois quando ambos estão garantidos", () => {
    const r = computeEleicaoMatematica(
      corrida({
        cargo: 5,
        votos: [1000, 900, 100],
        secoesTotal: 1000,
        secoesTotalizadas: 990,
        validos: 2000,
      }),
    );
    expect(r.estado).toBe("parcial");
    // Com 2 vagas, o corte é o 2º colocado; o adjacente por fora (3º) é o
    // melhor adversário, e o teto dele não alcança o 2º.
    expect(r.numeros).toEqual(["1", "2"]);
  });

  it("Senador (2 vagas): marca só o primeiro quando a 2ª vaga está aberta", () => {
    const r = computeEleicaoMatematica(
      corrida({
        cargo: 5,
        votos: [1000, 300, 290],
        secoesTotal: 1000,
        secoesTotalizadas: 990,
        validos: 1590,
      }),
    );
    expect(r.estado).toBe("parcial");
    expect(r.numeros).toEqual(["1"]);
  });

  it("marca apenas quem está garantido; empate na última vaga não marca os empatados", () => {
    const r = computeEleicaoMatematica(
      corrida({
        cargo: 5,
        votos: [1000, 300, 300],
        secoesTotal: 1000,
        secoesTotalizadas: 990,
        validos: 1600,
      }),
    );
    // 2 vagas para 3 empatados: individualmente nenhum dos empatados está
    // garantido (qualquer um pode ficar de fora), então só o líder é marcado.
    expect(r.estado).toBe("parcial");
    expect(r.numeros).toEqual(["1"]);
  });
});

describe("withEleicaoMatematica", () => {
  it("não sobrescreve quem já é oficialmente eleito", () => {
    const base = corrida({
      cargo: 5,
      votos: [1000, 900, 100],
      secoesTotal: 1000,
      secoesTotalizadas: 990,
      validos: 2000,
      eleitos: [1, 2],
    });
    const enriquecida = withEleicaoMatematica(base);
    expect(enriquecida.candidatos.every((c) => c.matematicamenteEleito === false)).toBe(true);
  });

  it("marca matematicamenteEleito sem alterar os votos", () => {
    const base = corrida({
      cargo: 3,
      votos: [1000, 200, 50],
      secoesTotal: 1000,
      secoesTotalizadas: 990,
      validos: 1250,
    });
    const enriquecida = withEleicaoMatematica(base);
    expect(enriquecida.candidatos[0]?.matematicamenteEleito).toBe(true);
    expect(enriquecida.candidatos[0]?.votos).toBe(1000);
    expect(enriquecida.candidatos[1]?.matematicamenteEleito).toBe(false);
  });

  it("o fixture bruto do TSE já sai com o campo derivado", () => {
    const race = withEleicaoMatematica(normalizeResultado(read("presidente-br.json") as never));
    expect(race.candidatos.every((c) => c.matematicamenteEleito === false)).toBe(true);
  });
});
