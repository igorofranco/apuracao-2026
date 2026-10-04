import { describe, expect, it } from "vitest";
import {
  PARTIDOS,
  corPartido,
  getPartido,
  nomePartido,
  siglaCanonica,
} from "./partidos";

/** Matiz (0–360) de uma cor hex. */
function matiz(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Tons quentes: vermelho/laranja/amarelo (0–60) ou carmim/magenta (300–360). */
function quente(hex: string): boolean {
  const h = matiz(hex);
  return h <= 60 || h >= 300;
}

describe("siglaCanonica", () => {
  it("remove acentos, espaços e pontuação", () => {
    expect(siglaCanonica("UNIÃO")).toBe("UNIAO");
    expect(siglaCanonica("PC do B")).toBe("PCDOB");
    expect(siglaCanonica("psdb")).toBe("PSDB");
  });
});

describe("getPartido / nomePartido", () => {
  it("resolve siglas independente de acento e caixa", () => {
    expect(getPartido("união")?.sigla).toBe("UNIÃO");
    expect(getPartido("UNIAO")?.sigla).toBe("UNIÃO");
    expect(nomePartido("PT")).toBe("Partido dos Trabalhadores");
  });

  it("retorna undefined/nome original para sigla desconhecida", () => {
    expect(getPartido("ZZZ")).toBeUndefined();
    expect(nomePartido("ZZZ")).toBe("ZZZ");
  });
});

describe("corPartido", () => {
  it("usa a cor da paleta e normaliza a sigla", () => {
    expect(corPartido("UNIÃO")).toBe("#3949AB");
    expect(corPartido("UNIAO")).toBe(corPartido("UNIÃO"));
    expect(corPartido("PL")).toBe("#0B3D91");
  });

  it("gera cor estável para sigla fora da paleta", () => {
    expect(corPartido("ZZZ")).toBe(corPartido("ZZZ"));
    expect(corPartido("ZZZ")).toMatch(/^hsl\(/);
  });
});

describe("espectro → temperatura da cor", () => {
  it("partidos de esquerda usam tons quentes", () => {
    for (const sigla of ["PT", "PSOL", "PCdoB", "PDT", "PSB"]) {
      expect(quente(corPartido(sigla)), `${sigla} deveria ser quente`).toBe(true);
    }
  });

  it("partidos de direita usam tons frios", () => {
    for (const sigla of ["PL", "REPUBLICANOS", "UNIÃO", "NOVO", "PSDB"]) {
      expect(quente(corPartido(sigla)), `${sigla} deveria ser frio`).toBe(false);
    }
  });

  it("todas as siglas da paleta são únicas e têm hex válido", () => {
    const siglas = PARTIDOS.map((p) => siglaCanonica(p.sigla));
    expect(new Set(siglas).size).toBe(siglas.length);
    for (const p of PARTIDOS) {
      expect(p.cor, `${p.sigla} deveria ter cor hex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
