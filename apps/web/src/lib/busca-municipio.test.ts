import { describe, expect, it } from "vitest";
import { buscarMunicipios, normalizarBusca } from "./busca-municipio";

const MUNICIPIOS = [
  { id: "3550308", uf: "sp", nome: "São Paulo" },
  { id: "3304557", uf: "rj", nome: "Rio de Janeiro" },
  { id: "4314902", uf: "rs", nome: "Porto Alegre" },
  { id: "3548708", uf: "sp", nome: "São Bernardo do Campo" },
  { id: "2413706", uf: "rn", nome: "São Paulo do Potengi" },
  { id: "3509502", uf: "sp", nome: "Campinas" },
  { id: "9999999", uf: "xx", nome: "Novo Porto" },
];

describe("normalizarBusca", () => {
  it("remove acentos, caixa e espaços nas pontas", () => {
    expect(normalizarBusca("  SÃO PAULO ")).toBe("sao paulo");
    expect(normalizarBusca("Açu")).toBe("acu");
  });
});

describe("buscarMunicipios", () => {
  it("busca sem acento e sem diferenciar maiúsculas", () => {
    const nomes = buscarMunicipios(MUNICIPIOS, "sao paulo").map((m) => m.nome);
    expect(nomes).toEqual(["São Paulo", "São Paulo do Potengi"]);
  });

  it("dá prioridade a quem começa com o termo", () => {
    const nomes = buscarMunicipios(MUNICIPIOS, "porto").map((m) => m.nome);
    // "Porto Alegre" começa com o termo; "Novo Porto" só o contém.
    expect(nomes).toEqual(["Porto Alegre", "Novo Porto"]);
  });

  it("ignora termos curtos demais", () => {
    expect(buscarMunicipios(MUNICIPIOS, "s")).toEqual([]);
    expect(buscarMunicipios(MUNICIPIOS, " ")).toEqual([]);
  });

  it("respeita o limite de resultados", () => {
    expect(buscarMunicipios(MUNICIPIOS, "sao", 1)).toHaveLength(1);
    expect(buscarMunicipios(MUNICIPIOS, "sao", 0)).toEqual([]);
  });

  it("devolve lista vazia quando nada casa", () => {
    expect(buscarMunicipios(MUNICIPIOS, "xyz")).toEqual([]);
  });
});
