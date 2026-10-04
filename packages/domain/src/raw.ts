import { z } from "zod";
import { toNumber, toPercent } from "./numbers.ts";

/**
 * Schemas tolerantes para os arquivos de resultado do TSE
 * (`...-c000X-eXXXXXX-u.json`). O TSE não publica um contrato estável, então
 * validamos apenas o que consumimos e deixamos o resto passar (`loose`).
 *
 * Referência de campos extraída do app oficial de resultados.
 */

/** Aceita número ou string e converte para número (vírgula decimal vira ponto). */
const numFromString = z.union([z.number(), z.string()]).transform(toNumber);

/** Percentual: ponto ou vírgula como decimal (ex.: "50,00" -> 50). */
const pctFromString = z.union([z.number(), z.string()]).transform(toPercent);

export const viceSchema = z.looseObject({
  sqcand: z.string().optional(),
  nm: z.string().optional(),
  nmu: z.string().optional(),
  sgp: z.string().optional(),
  tp: z.string().optional(),
});

export const candidatoSchema = z.looseObject({
  n: z.string(),
  sqcand: z.string().optional(),
  nm: z.string(),
  nmu: z.string().optional(),
  dt: z.string().optional(),
  seq: z.string().optional(),
  /** "n" = não eleito, "s" = eleito (sim). */
  e: z.string().optional(),
  /** Situação textual (ex.: "Eleito", "2º turno"). */
  st: z.string().optional(),
  /** Destinação do voto. */
  dvt: z.string().optional(),
  /** Votos apurados. */
  vap: numFromString.optional(),
  /** Percentual informado pelo TSE. */
  pvap: pctFromString.optional(),
  pvapn: pctFromString.optional(),
  vs: z.array(viceSchema).optional(),
});

export const partidoSchema = z.looseObject({
  n: z.string(),
  sg: z.string().optional(),
  nm: z.string().optional(),
  nfed: z.string().optional(),
  tvtn: z.string().optional(),
  tvan: z.string().optional(),
  cand: z.array(candidatoSchema).default([]),
});

export const agremiacaoSchema = z.looseObject({
  n: z.string(),
  nm: z.string().optional(),
  /** Tipo: "i" (isolada), "c" (coligação), "f" (federação). */
  tp: z.string().optional(),
  com: z.string().optional(),
  tvtn: z.string().optional(),
  tvan: z.string().optional(),
  par: z.array(partidoSchema).default([]),
});

export const fedSchema = z.looseObject({
  n: z.string(),
  sg: z.string().optional(),
  nm: z.string().optional(),
  com: z.string().optional(),
  npar: z.array(z.string()).optional(),
});

export const cargoSchema = z.looseObject({
  cd: z.string(),
  nmn: z.string().optional(),
  nmm: z.string().optional(),
  nmf: z.string().optional(),
  nv: z.string().optional(),
  fed: z.array(fedSchema).optional(),
  agr: z.array(agremiacaoSchema).default([]),
});

export const secoesSchema = z.looseObject({
  ts: z.string().optional(),
  st: z.string().optional(),
  pst: z.string().optional(),
  snt: z.string().optional(),
  psnt: z.string().optional(),
  si: z.string().optional(),
  psi: z.string().optional(),
  sni: z.string().optional(),
  psni: z.string().optional(),
  sa: z.string().optional(),
  psa: z.string().optional(),
  sna: z.string().optional(),
  psna: z.string().optional(),
});

export const eleitoradoSchema = z.looseObject({
  te: z.string().optional(),
  est: z.string().optional(),
  pest: z.string().optional(),
  esnt: z.string().optional(),
  pesnt: z.string().optional(),
  esa: z.string().optional(),
  pesa: z.string().optional(),
  esna: z.string().optional(),
  pesna: z.string().optional(),
  c: z.string().optional(),
  pc: z.string().optional(),
  a: z.string().optional(),
  pa: z.string().optional(),
});

export const votosSchema = z.looseObject({
  tv: z.string().optional(),
  vvc: z.string().optional(),
  pvvc: z.string().optional(),
  vv: z.string().optional(),
  pvv: z.string().optional(),
  vnom: z.string().optional(),
  pvnom: z.string().optional(),
  vl: z.string().optional(),
  pvl: z.string().optional(),
  vb: z.string().optional(),
  pvb: z.string().optional(),
  vn: z.string().optional(),
  pvn: z.string().optional(),
  vnt: z.string().optional(),
  pvnt: z.string().optional(),
  tvn: z.string().optional(),
  ptvn: z.string().optional(),
  van: z.string().optional(),
  pvan: z.string().optional(),
  vansj: z.string().optional(),
  pvansj: z.string().optional(),
  vp: z.string().optional(),
  pvp: z.string().optional(),
});

export const resultadoSchema = z.looseObject({
  ele: z.string(),
  t: z.string().optional(),
  f: z.string().optional(),
  sup: z.string().optional(),
  tpabr: z.string().optional(),
  cdabr: z.string().optional(),
  dg: z.string().optional(),
  hg: z.string().optional(),
  idg: z.string().optional(),
  dt: z.string().optional(),
  ht: z.string().optional(),
  dv: z.string().optional(),
  tf: z.string().optional(),
  and: z.string().optional(),
  carg: z.array(cargoSchema).default([]),
  s: secoesSchema.optional(),
  e: eleitoradoSchema.optional(),
  v: votosSchema.optional(),
});

export type RawResultado = z.infer<typeof resultadoSchema>;
export type RawCargo = z.infer<typeof cargoSchema>;
export type RawCandidato = z.infer<typeof candidatoSchema>;
export type RawAgremiacao = z.infer<typeof agremiacaoSchema>;

/**
 * Config global `ele-c.json`: lista de pleitos, eleições, cargos e abrangências.
 */
export const configCargoSchema = z.looseObject({
  cd: z.string(),
  ds: z.string().optional(),
  tp: z.string().optional(),
});

export const configAbrangenciaSchema = z.looseObject({
  cd: z.string(),
  mu: z.array(z.looseObject({ cd: z.string(), cdi: z.string().optional() })).optional(),
  cp: z.array(configCargoSchema).optional(),
});

export const configEleicaoSchema = z.looseObject({
  cd: z.string(),
  cdt2: z.string().optional(),
  sqele: z.string().optional(),
  nm: z.string().optional(),
  /** Data do pleito (DD/MM/AAAA). */
  dt: z.string().optional(),
  dtlim: z.string().optional(),
  t: z.string().optional(),
  tp: z.string().optional(),
  abr: z.array(configAbrangenciaSchema).default([]),
});

export const configPleitoSchema = z.looseObject({
  cd: z.string(),
  cdpr: z.string().optional(),
  c: z.string(),
  dt: z.string().optional(),
  dtlim: z.string().optional(),
  e: z.array(configEleicaoSchema).default([]),
});

/** Arquivo `mun-e<cd6>-cm.json`: municípios e zonas por UF. */
export const municipioFileSchema = z.looseObject({
  dg: z.string().optional(),
  hg: z.string().optional(),
  idg: z.string().optional(),
  abr: z.array(
    z.looseObject({
      cd: z.string(),
      ds: z.string().optional(),
      mu: z.array(
        z.looseObject({
          cd: z.string(),
          cdi: z.string().optional(),
          nm: z.string().optional(),
          z: z.array(z.string()).optional(),
        }),
      ).default([]),
    }),
  ).default([]),
});

export type RawMunicipioFile = z.infer<typeof municipioFileSchema>;

export const configSchema = z.looseObject({
  dg: z.string().optional(),
  hg: z.string().optional(),
  arq: z
    .array(z.looseObject({ tp: z.string(), dir: z.string() }))
    .optional(),
  pl: z.array(configPleitoSchema).default([]),
});

export type RawConfig = z.infer<typeof configSchema>;
export type RawConfigPleito = z.infer<typeof configPleitoSchema>;
export type RawConfigEleicao = z.infer<typeof configEleicaoSchema>;
