import { TSE_AMBIENTE, TSE_BASE_URL } from "@apuracao/shared";

export interface UrlContext {
  baseUrl?: string;
  ambiente?: string;
}

function base(ctx: UrlContext): string {
  const b = ctx.baseUrl ?? TSE_BASE_URL;
  return b.endsWith("/") ? b : `${b}/`;
}

function ambiente(ctx: UrlContext): string {
  return ctx.ambiente ?? TSE_AMBIENTE;
}

const pad = (n: number | string, len: number) => String(n).padStart(len, "0");

/** Config global do ciclo (ex.: `oficial/comum/config/ele-c.json`). */
export function configPath(ext = "json", ctx: UrlContext = {}): string {
  return `${base(ctx)}${ambiente(ctx)}/comum/config/ele-c.${ext}`;
}

/** Lista de municípios de uma eleição (ex.: `.../6257/config/mun-e006257-cm.json`). */
export function municipiosPath(
  ciclo: string,
  cdEleicao: number,
  ext = "json",
  ctx: UrlContext = {},
): string {
  const file = `mun-e${pad(cdEleicao, 6)}-cm.${ext}`;
  return `${base(ctx)}${ambiente(ctx)}/${ciclo}/${cdEleicao}/config/${file}`;
}

export interface ResultadoFileOptions {
  ciclo: string;
  cdEleicao: number;
  /** Cargo TSE (1, 3, 5, 6, 7, 8...). */
  cargo: number;
  /** UF minúscula (ex.: "sp") ou "br" para agregação nacional. */
  uf: string;
  /** Município TSE (5 dígitos) para drill-down. */
  municipio?: string | number;
  /** Zona eleitoral para drill-down. */
  zona?: string | number;
  ext?: "json" | "jws";
  ctx?: UrlContext;
}

/**
 * URL do arquivo de resultado, no formato:
 * `<uf>[-<municipio5>][-z<zona4>]-c<cargo4>-e<cd_eleicao6>-u.json`
 */
export function resultadoPath(options: ResultadoFileOptions): string {
  const { ciclo, cdEleicao, cargo, uf, municipio, zona } = options;
  const ext = options.ext ?? "json";
  const ctx = options.ctx ?? {};
  const ufSeg = uf.toLowerCase();
  const muniSeg = municipio != null && municipio !== "" ? pad(municipio, 5) : "";
  const zonaSeg = zona != null && zona !== "" ? `-z${pad(zona, 4)}` : "";
  const file = `${ufSeg}${muniSeg}${zonaSeg}-c${pad(cargo, 4)}-e${pad(cdEleicao, 6)}-u.${ext}`;
  return `${base(ctx)}${ambiente(ctx)}/${ciclo}/${cdEleicao}/dados/${ufSeg}/${file}`;
}
