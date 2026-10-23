/**
 * Identificadores da eleição de 2026 descobertos no config oficial do TSE
 * (`oficial/comum/config/ele-c.json`).
 */
export const ELEICAO_2026 = {
  /** Ciclo usado nas URLs (ex.: `ele2026`). */
  ciclo: "ele2026",
  /** Código do pleito. */
  pleito: 3220,
  /** Data do 1º turno. */
  data: "2026-10-04",
  /** Data do 2º turno (Presidente e Governador). */
  dataSegundoTurno: "2026-10-25",
  eleicoes: {
    /** Eleição Federal (Presidente) do 1º turno. */
    federal: 6257,
    /** Eleição Federal (Presidente) do 2º turno. */
    federalSegundoTurno: 6258,
    /** Eleição Estadual (Governador, Senador, Dep. Federal, Dep. Estadual, Dep. Distrital) do 1º turno. */
    estadual: 6259,
    /** Eleição Estadual (Governador) do 2º turno. */
    estadualSegundoTurno: 6260,
    /** Eleição Municipal (Conselheiro Distrital de Fernando de Noronha). */
    municipal: 6261,
  },
} as const;

/** Base dos arquivos estáticos de resultado do TSE. */
export const TSE_BASE_URL = "https://resultados.tse.jus.br/";

/**
 * Ambiente dentro da base (o app oficial usa "oficial" em produção).
 * Existe também "homologacao" para testes.
 */
export const TSE_AMBIENTE = "oficial";

/**
 * Chave pública (JWK, Ed25519) usada pelo TSE para assinar os arquivos `.jws`.
 * Extraída do app oficial de resultados. Permite verificar a integridade.
 */
export const TSE_JWS_PUBLIC_KEY = {
  kty: "OKP",
  use: "sig",
  key_ops: ["verify"],
  alg: "EdDSA",
  kid: "sNbt9Q_fLS65zE1_ZLNV-XRRwPY",
  crv: "Ed25519",
  x: "kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc",
} as const;
