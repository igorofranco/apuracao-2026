import { describe, expect, it } from "vitest";
import {
  PAINEL_PADRAO,
  adicionarCorrida,
  corridaValida,
  chaveCorrida,
  moverCorrida,
  removerCorrida,
  rotuloCorrida,
  sanitizarConfig,
  type CorridaFixada,
} from "./painel";

const presidente: CorridaFixada = { cargo: 1, uf: "br" };
const govMg: CorridaFixada = { cargo: 3, uf: "mg" };
const senMg: CorridaFixada = { cargo: 5, uf: "mg" };
const govSp: CorridaFixada = { cargo: 3, uf: "sp" };

describe("corridaValida", () => {
  it("aceita Presidente apenas em br", () => {
    expect(corridaValida(presidente)).toBe(true);
    expect(corridaValida({ cargo: 1, uf: "sp" })).toBe(false);
  });

  it("aceita cargos estaduais existentes na UF", () => {
    expect(corridaValida(govMg)).toBe(true);
    expect(corridaValida(senMg)).toBe(true);
  });

  it("rejeita combinações inexistentes", () => {
    expect(corridaValida({ cargo: 7, uf: "df" })).toBe(false); // Dep. Estadual no DF
    expect(corridaValida({ cargo: 8, uf: "sp" })).toBe(false); // Dep. Distrital fora do DF
    expect(corridaValida({ cargo: 99, uf: "sp" })).toBe(false);
    expect(corridaValida({ cargo: 3, uf: "zz" })).toBe(false);
  });
});

describe("adicionarCorrida/removerCorrida", () => {
  it("adiciona sem duplicar", () => {
    const comUm = adicionarCorrida([], govMg);
    expect(comUm).toEqual([govMg]);
    expect(adicionarCorrida(comUm, govMg)).toEqual([govMg]);
  });

  it("ignora inválidas", () => {
    expect(adicionarCorrida([], { cargo: 3, uf: "zz" })).toEqual([]);
  });

  it("remove pela chave", () => {
    expect(removerCorrida([presidente, govMg], govMg)).toEqual([presidente]);
    expect(removerCorrida([presidente], govSp)).toEqual([presidente]);
  });
});

describe("moverCorrida", () => {
  const itens = [presidente, govMg, senMg];

  it("move para cima e para baixo", () => {
    expect(moverCorrida(itens, govMg, -1).map(chaveCorrida)).toEqual([
      "3:mg",
      "1:br",
      "5:mg",
    ]);
    expect(moverCorrida(itens, govMg, 1).map(chaveCorrida)).toEqual([
      "1:br",
      "5:mg",
      "3:mg",
    ]);
  });

  it("respeita os limites", () => {
    expect(moverCorrida(itens, presidente, -1)).toEqual(itens);
    expect(moverCorrida(itens, senMg, 1)).toEqual(itens);
    expect(moverCorrida(itens, { cargo: 5, uf: "sp" }, 1)).toEqual(itens);
  });
});

describe("rotuloCorrida", () => {
  it("usa Brasil para cargos nacionais", () => {
    expect(rotuloCorrida(presidente)).toEqual({ titulo: "Presidente", local: "Brasil" });
  });

  it("usa o nome da UF para cargos estaduais", () => {
    expect(rotuloCorrida(govMg)).toEqual({ titulo: "Governador", local: "Minas Gerais" });
  });
});

describe("sanitizarConfig", () => {
  it("volta ao padrão com entrada inválida", () => {
    expect(sanitizarConfig(null)).toEqual(PAINEL_PADRAO);
    expect(sanitizarConfig("oi")).toEqual(PAINEL_PADRAO);
    expect(sanitizarConfig({ itens: "x" })).toEqual({ itens: [], topN: 3 });
  });

  it("filtra inválidas, deduplica e normaliza a UF", () => {
    const config = sanitizarConfig({
      itens: [
        { cargo: 3, uf: "MG" },
        { cargo: 3, uf: "mg" },
        { cargo: 7, uf: "df" },
        { cargo: 8, uf: "sp" },
        { cargo: 1, uf: "br" },
        null,
      ],
      topN: 9,
    });
    expect(config.itens).toEqual([
      { cargo: 3, uf: "mg" },
      { cargo: 1, uf: "br" },
    ]);
    expect(config.topN).toBe(3);
  });

  it("mantém topN 5 quando válido", () => {
    expect(sanitizarConfig({ itens: [], topN: 5 }).topN).toBe(5);
  });
});
