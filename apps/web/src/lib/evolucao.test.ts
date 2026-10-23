import { describe, expect, it } from "vitest";
import type { Snapshot } from "@apuracao/domain";
import { recortarEvolucao } from "./evolucao";

function snap(
  hora: number,
  percentuais: [number, number] | null,
): Snapshot {
  const [a, b] = percentuais ?? [0, 0];
  const temVotos = percentuais !== null && (a > 0 || b > 0);
  return {
    eleicao: 6258,
    cargo: 1,
    uf: "br",
    geracao: `g${hora}`,
    capturadoEm: `2026-10-25T19:${String(hora).padStart(2, "0")}:00-03:00`,
    percentualApurado: temVotos ? 20 + hora : 0,
    votosValidos: temVotos ? 1_000_000 + hora : 0,
    lider: temVotos
      ? { numero: "13", nomeUrna: "LULA", votos: 600_000 + hora }
      : null,
    candidatos: percentuais
      ? [
          {
            numero: "22",
            nomeUrna: "FLAVIO BOLSONARO",
            siglaPartido: "PL",
            votos: Math.round(b * 1000),
            percentual: b,
          },
          {
            numero: "13",
            nomeUrna: "LULA",
            siglaPartido: "PT",
            votos: Math.round(a * 1000),
            percentual: a,
          },
        ]
      : undefined,
  };
}

describe("recortarEvolucao", () => {
  it("remove o início sem dados e o fim repetido", () => {
    const serie = [
      snap(0, null),
      snap(1, [50, 50]),
      snap(2, [52, 48]),
      snap(3, [55, 45]),
      snap(4, [55, 45]),
      snap(5, [55, 45]),
    ];
    const resultado = recortarEvolucao(serie);
    expect(resultado.snapshots.map((s) => s.geracao)).toEqual(["g1", "g2", "g3"]);
    expect(resultado.candidatos.map((c) => c.numero)).toEqual(["13", "22"]);
    expect(resultado.recortado).toBe(true);
  });

  it("remove a repetição inicial, mantendo um ponto de base", () => {
    const serie = [
      snap(0, [55, 45]),
      snap(1, [55, 45]),
      snap(2, [56, 44]),
      snap(3, [57, 43]),
      snap(4, [57, 43]),
    ];
    const resultado = recortarEvolucao(serie);
    expect(resultado.snapshots.map((s) => s.geracao)).toEqual(["g1", "g2", "g3"]);
    expect(resultado.recortado).toBe(true);
  });

  it("não devolve série quando não há mudança", () => {
    const serie = [snap(0, [50, 50]), snap(1, [50, 50]), snap(2, [50, 50])];
    const resultado = recortarEvolucao(serie);
    expect(resultado.snapshots).toEqual([]);
    expect(resultado.candidatos).toEqual([]);
    expect(resultado.recortado).toBe(true);
  });

  it("devolve vazio sem snapshots ou sem a votação por candidato", () => {
    expect(recortarEvolucao([]).snapshots).toEqual([]);
    const legado = [{ ...snap(0, [50, 50]), candidatos: undefined }];
    expect(recortarEvolucao(legado).snapshots).toEqual([]);
  });

  it("mantém as duas pontas quando a série já começa e termina mudando", () => {
    const serie = [snap(0, [50, 50]), snap(1, [52, 48]), snap(2, [55, 45])];
    const resultado = recortarEvolucao(serie);
    expect(resultado.snapshots).toHaveLength(3);
    expect(resultado.recortado).toBe(false);
  });
});
