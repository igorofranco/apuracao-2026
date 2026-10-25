import { describe, expect, it } from "vitest";
import { dominioGrafico } from "./grafico";

describe("dominioGrafico", () => {
  it("usa 0–100 quando a escala é absoluta", () => {
    expect(dominioGrafico([51.3, 48.7], "absoluto")).toEqual([0, 100]);
    expect(dominioGrafico([], "absoluto")).toEqual([0, 100]);
  });

  it("usa o mínimo e o máximo dos dados na escala relativa", () => {
    expect(dominioGrafico([55.3, 44.7, 51.3, 48.7], "relativo")).toEqual([
      44.7, 55.3,
    ]);
  });

  it("devolve 0–100 quando não há valores", () => {
    expect(dominioGrafico([], "relativo")).toEqual([0, 100]);
  });

  it("abre 1 ponto quando todos os valores são iguais", () => {
    expect(dominioGrafico([50, 50], "relativo")).toEqual([49, 51]);
    expect(dominioGrafico([0, 0], "relativo")).toEqual([0, 1]);
    expect(dominioGrafico([100, 100], "relativo")).toEqual([99, 100]);
  });

  it("respeita os limites de 0 a 100", () => {
    expect(dominioGrafico([-5, 110], "relativo")).toEqual([0, 100]);
  });
});
