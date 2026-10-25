import { describe, expect, it } from "vitest";
import type { Snapshot } from "@apuracao/domain";
import { construirGrafico } from "../src/grafico.ts";

type Valores = Array<[numero: string, percentual: number, votos: number]>;

function snapshot(
  minuto: number,
  percentualApurado: number,
  valores: Valores,
  nome = "C",
): Snapshot {
  return {
    eleicao: 6258,
    cargo: 1,
    uf: "br",
    geracao: `20261025${String(minuto).padStart(4, "0")}`,
    capturadoEm: `2026-10-25T19:${String(minuto % 60).padStart(2, "0")}:00-03:00`,
    percentualApurado,
    votosValidos: valores.reduce((total, [, , votos]) => total + votos, 0),
    lider: null,
    candidatos: valores.map(([numero, percentual, votos]) => ({
      numero,
      nomeUrna: `${nome}${numero}`,
      siglaPartido: "XX",
      votos,
      percentual,
    })),
  };
}

const params = { eleicao: 6258, cargo: 1, uf: "br" };

describe("construirGrafico", () => {
  it("recorta o início sem dados e a repetição final", () => {
    const snapshots = [
      snapshot(0, 0, [
        ["13", 0, 0],
        ["22", 0, 0],
      ]),
      snapshot(1, 10, [
        ["13", 55, 5_500],
        ["22", 45, 4_500],
      ]),
      snapshot(2, 60, [
        ["13", 52, 31_200],
        ["22", 48, 28_800],
      ]),
      snapshot(3, 100, [
        ["13", 51.3, 51_300],
        ["22", 48.7, 48_700],
      ]),
      snapshot(4, 100, [
        ["13", 51.3, 51_300],
        ["22", 48.7, 48_700],
      ]),
      snapshot(5, 100, [
        ["13", 51.3, 51_300],
        ["22", 48.7, 48_700],
      ]),
    ];

    const grafico = construirGrafico(params, snapshots);

    expect(grafico.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
    expect(grafico.pontos.map((p) => p.em)).toEqual([
      snapshots[1]!.capturadoEm,
      snapshots[2]!.capturadoEm,
      snapshots[3]!.capturadoEm,
    ]);
    expect(grafico.pontos[0]!.percentuais).toEqual({ "13": 55, "22": 45 });
    expect(grafico.pontos[2]!.percentuais).toEqual({ "13": 51.3, "22": 48.7 });
    expect(grafico.recortado).toBe(true);
    expect(grafico.amostras).toBe(6);
    expect(grafico.atualizadoEm).toBe(snapshots[5]!.capturadoEm);
  });

  it("mantém a série vazia quando os percentuais nunca mudam", () => {
    const snapshots = [
      snapshot(1, 10, [
        ["13", 50, 1_000],
        ["22", 50, 1_000],
      ]),
      snapshot(2, 50, [
        ["13", 50, 5_000],
        ["22", 50, 5_000],
      ]),
      snapshot(3, 100, [
        ["13", 50, 10_000],
        ["22", 50, 10_000],
      ]),
    ];

    const grafico = construirGrafico(params, snapshots);

    expect(grafico.candidatos).toHaveLength(2);
    expect(grafico.pontos).toEqual([]);
    expect(grafico.recortado).toBe(true);
  });

  it("devolve tudo vazio quando não há snapshot com dados", () => {
    const grafico = construirGrafico(params, [
      snapshot(0, 0, [
        ["13", 0, 0],
        ["22", 0, 0],
      ]),
    ]);

    expect(grafico).toMatchObject({
      candidatos: [],
      pontos: [],
      amostras: 1,
    });
    expect(grafico.atualizadoEm).not.toBeNull();
  });

  it("usa só os dois candidatos mais votados", () => {
    const snapshots = [
      snapshot(1, 10, [
        ["13", 40, 4_000],
        ["22", 35, 3_500],
        ["30", 25, 2_500],
      ]),
      snapshot(2, 20, [
        ["13", 42, 8_400],
        ["22", 33, 6_600],
        ["30", 25, 5_000],
      ]),
      snapshot(3, 30, [
        ["13", 45, 13_500],
        ["22", 30, 9_000],
        ["30", 25, 7_500],
      ]),
    ];

    const grafico = construirGrafico(params, snapshots);

    expect(grafico.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
    expect(Object.keys(grafico.pontos[0]!.percentuais).sort()).toEqual([
      "13",
      "22",
    ]);
  });

  it("marca null quando o candidato não existia na amostra", () => {
    const snapshots = [
      snapshot(1, 10, [["13", 60, 6_000]]),
      snapshot(2, 20, [
        ["13", 58, 11_600],
        ["22", 42, 8_400],
      ]),
    ];

    const grafico = construirGrafico(params, snapshots);

    expect(grafico.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
    expect(grafico.pontos[0]!.percentuais["22"]).toBeNull();
    expect(grafico.pontos[1]!.percentuais["22"]).toBe(42);
  });

  it("reduz a série sem perder as pontas", () => {
    const snapshots = Array.from({ length: 200 }, (_, i) =>
      snapshot(
        i,
        Math.min(100, i / 2),
        [
          ["13", 50 + i * 0.01, 1_000 + i],
          ["22", 50 - i * 0.01, 900 + i],
        ],
      ),
    );

    const grafico = construirGrafico(params, snapshots, { maxPontos: 20 });

    expect(grafico.pontos.length).toBeLessThanOrEqual(20);
    expect(grafico.pontos[0]!.em).toBe(snapshots[0]!.capturadoEm);
    expect(grafico.pontos.at(-1)!.em).toBe(snapshots.at(-1)!.capturadoEm);
  });
});
