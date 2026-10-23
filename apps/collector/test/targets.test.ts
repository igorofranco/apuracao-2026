import { describe, expect, it } from "vitest";
import type { EleicoesResolvidas } from "../src/eleicoes.ts";
import { buildTargets } from "../src/targets.ts";

const primeiroTurno = {
  ciclo: "ele2026",
  federal: { cd: 6257, turno: 1, data: null, nome: "Federal" },
  estadual: { cd: 6259, turno: 1, data: null, nome: "Estadual" },
  doConfig: true,
} satisfies EleicoesResolvidas;

const segundoTurno: EleicoesResolvidas = {
  ...primeiroTurno,
  federal: { cd: 6258, turno: 2, data: null, nome: "Federal" },
  estadual: { cd: 6260, turno: 2, data: null, nome: "Estadual" },
  primeiroTurno: {
    federal: primeiroTurno.federal,
    estadual: primeiroTurno.estadual,
  },
};

describe("buildTargets", () => {
  it("no 1º turno usa a eleição atual em todos os cargos", () => {
    const targets = buildTargets(primeiroTurno);
    const presidentes = targets.filter((t) => t.cargo === 1);
    // Nacional + uma corrida por UF (para o mapa por estado).
    expect(presidentes).toHaveLength(1 + 27);
    expect(presidentes.every((t) => t.eleicao === 6257)).toBe(true);
    expect(presidentes.some((t) => t.uf === "br")).toBe(true);
    expect(presidentes.some((t) => t.uf === "sp")).toBe(true);
    for (const t of targets.filter((t) => t.cargo !== 1)) {
      expect(t.eleicao).toBe(6259);
    }

    // Só o Presidente nacional fica na cadência rápida (cartões em tempo real).
    expect(targets.filter((t) => t.grupo === "rapida")).toHaveLength(1);
    expect(
      targets.find((t) => t.grupo === "rapida"),
    ).toMatchObject({ cargo: 1, uf: "br" });
    expect(targets.filter((t) => t.grupo === "lenta")).toHaveLength(
      targets.length - 1,
    );
  });

  it("no 2º turno mantém Senador/Deputados no 1º turno", () => {
    const targets = buildTargets(segundoTurno);
    const achar = (cargo: number, uf: string) =>
      targets.find((t) => t.cargo === cargo && t.uf === uf);
    const eleicoesGovernador = (uf: string) =>
      targets
        .filter((t) => t.cargo === 3 && t.uf === uf)
        .map((t) => t.eleicao)
        .sort((a, b) => a - b);

    // Presidente volta às urnas; Governador tem o 2º turno e o 1º como fallback
    // (estados sem disputa continuam com o resultado anterior).
    expect(achar(1, "br")?.eleicao).toBe(6258);
    expect(achar(1, "sp")?.eleicao).toBe(6258);
    expect(eleicoesGovernador("sp")).toEqual([6259, 6260]);
    expect(eleicoesGovernador("df")).toEqual([6259, 6260]);

    // Os demais cargos seguem com os dados do 1º turno.
    expect(achar(5, "sp")?.eleicao).toBe(6259);
    expect(achar(6, "sp")?.eleicao).toBe(6259);
    expect(achar(7, "sp")?.eleicao).toBe(6259);
    expect(achar(8, "df")?.eleicao).toBe(6259);
  });
});
