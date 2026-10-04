import { describe, expect, it } from "vitest";
import { raceKey, toBool, toNumber, toPercent } from "../src/index.ts";

describe("toNumber (votos: ponto = milhar, vírgula = decimal)", () => {
  it("interpreta separador de milhar e decimal", () => {
    expect(toNumber("1.234")).toBe(1234);
    expect(toNumber("1.234.567")).toBe(1234567);
    expect(toNumber("50,5")).toBe(50.5);
  });

  it("passa números adiante e trata vazios", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });
});

describe("toPercent (ponto ou vírgula como decimal)", () => {
  it("interpreta ponto e vírgula como decimal", () => {
    expect(toPercent("50,00")).toBe(50);
    expect(toPercent("50.00")).toBe(50);
    expect(toPercent("7,5")).toBe(7.5);
  });

  it("trata vazios", () => {
    expect(toPercent(null)).toBe(0);
    expect(toPercent("abc")).toBe(0);
  });
});

describe("toBool", () => {
  it("reconhece 's'/'S' como true", () => {
    expect(toBool("s")).toBe(true);
    expect(toBool("S")).toBe(true);
    expect(toBool("n")).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });
});

describe("raceKey", () => {
  it("monta a chave canônica", () => {
    expect(raceKey({ eleicao: 6257, cargo: 1, uf: "br" })).toBe("6257:1:br");
  });
});
