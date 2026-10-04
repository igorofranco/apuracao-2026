/**
 * Constantes do domínio eleitoral brasileiro usadas por collector, domínio e web.
 * Referências oficiais: TSE (códigos de cargo) e IBGE (UF).
 */

/** Unidade da federação (UF) com metadados úteis para mapa e navegação. */
export interface Uf {
  /** Sigla minúscula usada nas URLs do TSE (ex.: "sp"). */
  readonly uf: string;
  /** Nome por extenso. */
  readonly nome: string;
  /** Região do IBGE. */
  readonly regiao: Regiao;
  /** Código IBGE da UF. */
  readonly codigoIbge: number;
}

export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export const REGIOES: readonly Regiao[] = [
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
];

export const UFS: readonly Uf[] = [
  { uf: "ac", nome: "Acre", regiao: "Norte", codigoIbge: 12 },
  { uf: "al", nome: "Alagoas", regiao: "Nordeste", codigoIbge: 27 },
  { uf: "ap", nome: "Amapá", regiao: "Norte", codigoIbge: 16 },
  { uf: "am", nome: "Amazonas", regiao: "Norte", codigoIbge: 13 },
  { uf: "ba", nome: "Bahia", regiao: "Nordeste", codigoIbge: 29 },
  { uf: "ce", nome: "Ceará", regiao: "Nordeste", codigoIbge: 23 },
  { uf: "df", nome: "Distrito Federal", regiao: "Centro-Oeste", codigoIbge: 53 },
  { uf: "es", nome: "Espírito Santo", regiao: "Sudeste", codigoIbge: 32 },
  { uf: "go", nome: "Goiás", regiao: "Centro-Oeste", codigoIbge: 52 },
  { uf: "ma", nome: "Maranhão", regiao: "Nordeste", codigoIbge: 21 },
  { uf: "mt", nome: "Mato Grosso", regiao: "Centro-Oeste", codigoIbge: 51 },
  { uf: "ms", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", codigoIbge: 50 },
  { uf: "mg", nome: "Minas Gerais", regiao: "Sudeste", codigoIbge: 31 },
  { uf: "pa", nome: "Pará", regiao: "Norte", codigoIbge: 15 },
  { uf: "pb", nome: "Paraíba", regiao: "Nordeste", codigoIbge: 25 },
  { uf: "pr", nome: "Paraná", regiao: "Sul", codigoIbge: 41 },
  { uf: "pe", nome: "Pernambuco", regiao: "Nordeste", codigoIbge: 26 },
  { uf: "pi", nome: "Piauí", regiao: "Nordeste", codigoIbge: 22 },
  { uf: "rj", nome: "Rio de Janeiro", regiao: "Sudeste", codigoIbge: 33 },
  { uf: "rn", nome: "Rio Grande do Norte", regiao: "Nordeste", codigoIbge: 24 },
  { uf: "rs", nome: "Rio Grande do Sul", regiao: "Sul", codigoIbge: 43 },
  { uf: "ro", nome: "Rondônia", regiao: "Norte", codigoIbge: 11 },
  { uf: "rr", nome: "Roraima", regiao: "Norte", codigoIbge: 14 },
  { uf: "sc", nome: "Santa Catarina", regiao: "Sul", codigoIbge: 42 },
  { uf: "sp", nome: "São Paulo", regiao: "Sudeste", codigoIbge: 35 },
  { uf: "se", nome: "Sergipe", regiao: "Nordeste", codigoIbge: 28 },
  { uf: "to", nome: "Tocantins", regiao: "Norte", codigoIbge: 17 },
];

const UF_BY_SIGLA = new Map(UFS.map((u) => [u.uf, u]));

export function getUf(sigla: string): Uf | undefined {
  return UF_BY_SIGLA.get(sigla.toLowerCase());
}

export function isUf(sigla: string): boolean {
  return UF_BY_SIGLA.has(sigla.toLowerCase());
}

export const UF_SIGLAS: readonly string[] = UFS.map((u) => u.uf);
