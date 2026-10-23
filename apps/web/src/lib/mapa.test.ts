import { describe, expect, it } from "vitest";
import {
  COR_NEUTRA,
  corMapaPresidente,
  percentualEntreDois,
  posicaoAbsoluta,
  posicoesRelativas,
} from "./mapa";

const VERMELHO = "#D81E2C";
const AZUL = "#0B3D91";

describe("percentualEntreDois", () => {
  it("calcula a participação entre os dois candidatos", () => {
    expect(percentualEntreDois(60, 40)).toBe(60);
    expect(percentualEntreDois(1_234, 0)).toBe(100);
  });

  it("não inventa percentual quando ainda não há votos", () => {
    expect(percentualEntreDois(0, 0)).toBeNull();
  });
});

describe("posicaoAbsoluta", () => {
  it("usa a diferença real entre os candidatos", () => {
    expect(posicaoAbsoluta(50, 50)).toBe(0);
    // 60% × 40%: 20% do caminho para o lado do candidato A.
    expect(posicaoAbsoluta(60, 40)).toBeCloseTo(0.2);
    expect(posicaoAbsoluta(40, 60)).toBeCloseTo(-0.2);
    expect(posicaoAbsoluta(100, 0)).toBe(1);
    expect(posicaoAbsoluta(0, 100)).toBe(-1);
  });

  it("é neutra sem votos", () => {
    expect(posicaoAbsoluta(0, 0)).toBe(0);
  });
});

describe("posicoesRelativas", () => {
  it("leva o extremo de cada candidato às pontas da paleta", () => {
    // 40% é o estado mais favorável ao B (azul total); 72% ao A (vermelho total).
    expect(posicoesRelativas([40, 56, 72])).toEqual([-1, 0, 1]);
  });

  it("mantém a ordem dos estados", () => {
    const [a, b, c] = posicoesRelativas([50, 60, 55]) as [
      number,
      number,
      number,
    ];
    expect(a).toBeLessThan(b);
    expect(c).toBeGreaterThan(a);
    expect(c).toBeLessThan(b);
  });

  it("fica neutra quando todos os estados empatam", () => {
    expect(posicoesRelativas([50, 50, 50])).toEqual([0, 0, 0]);
  });
});

describe("corMapaPresidente", () => {
  it("usa as cores dos candidatos nas pontas e o neutro no centro", () => {
    expect(corMapaPresidente(1, VERMELHO, AZUL)).toBe("rgb(216, 30, 44)");
    expect(corMapaPresidente(-1, VERMELHO, AZUL)).toBe("rgb(11, 61, 145)");
    expect(corMapaPresidente(0, VERMELHO, AZUL)).toBe(COR_NEUTRA);
  });

  it("interpola proporcionalmente ao lado do candidato", () => {
    const canais = (cor: string) =>
      cor
        .replace(/[^\d,]/g, "")
        .split(",")
        .map(Number) as [number, number, number];
    const distancia = (cor: string, alvo: [number, number, number]) => {
      const [r, g, b] = canais(cor);
      return Math.hypot(r - alvo[0], g - alvo[1], b - alvo[2]);
    };
    const vermelho: [number, number, number] = [216, 30, 44];
    const quase = corMapaPresidente(0.2, VERMELHO, AZUL);
    const forte = corMapaPresidente(0.8, VERMELHO, AZUL);
    // Quanto maior a força, mais perto da cor cheia do candidato.
    expect(distancia(forte, vermelho)).toBeLessThan(distancia(quase, vermelho));
  });

  it("no modo direto vai de azul a vermelho sem passar pelo neutro", () => {
    expect(corMapaPresidente(1, VERMELHO, AZUL, "direto")).toBe(
      "rgb(216, 30, 44)",
    );
    expect(corMapaPresidente(-1, VERMELHO, AZUL, "direto")).toBe(
      "rgb(11, 61, 145)",
    );
    // Empate no modo direto = meio-termo literal entre as duas cores.
    expect(corMapaPresidente(0, VERMELHO, AZUL, "direto")).toBe(
      "rgb(114, 46, 95)",
    );
    expect(corMapaPresidente(0, VERMELHO, AZUL, "direto")).not.toBe(COR_NEUTRA);
  });

  it("protege contra posições inválidas", () => {
    expect(corMapaPresidente(Number.NaN, VERMELHO, AZUL)).toBe(COR_NEUTRA);
    expect(corMapaPresidente(3, VERMELHO, AZUL)).toBe("rgb(216, 30, 44)");
  });
});
