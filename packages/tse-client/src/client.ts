import type {
  RawConfig,
  RawConfigEleicao,
  RawConfigPleito,
  RawMunicipioFile,
  RawResultado,
} from "@apuracao/domain";
import {
  configSchema,
  municipioFileSchema,
  resultadoSchema,
} from "@apuracao/domain";
import { TSE_JWS_PUBLIC_KEY } from "@apuracao/shared";
import type { JwkPublicKey } from "./jws.ts";
import { verifyJws, JwsError } from "./jws.ts";
import {
  configPath,
  municipiosPath,
  resultadoPath,
  type ResultadoFileOptions,
} from "./urls.ts";

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export interface TseClientOptions {
  baseUrl?: string;
  ambiente?: string;
  /** Verifica a assinatura Ed25519 dos arquivos `.jws` (padrão: true). */
  verifyJws?: boolean;
  /** Timeout por requisição em ms (padrão: 15000). */
  timeoutMs?: number;
  /** Adiciona `?nocache=<timestamp>` (padrão: true). */
  cacheBust?: boolean;
  /** Chave pública usada na verificação (padrão: a oficial do TSE). */
  publicKey?: JwkPublicKey;
  /** `fetch` customizado (útil em testes). */
  fetchImpl?: typeof fetch;
}

interface FetchTextResult {
  text: string;
  etag: string | null;
  lastModified: string | null;
}

/**
 * Cliente dos arquivos estáticos de resultado do TSE.
 * Isola URLs, cache-bust e verificação de assinatura.
 */
export class TseClient {
  private readonly baseUrl: string;
  private readonly ambiente: string;
  private readonly verify: boolean;
  private readonly timeoutMs: number;
  private readonly cacheBust: boolean;
  private readonly publicKey: JwkPublicKey;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TseClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://resultados.tse.jus.br/";
    this.ambiente = options.ambiente ?? "oficial";
    this.verify = options.verifyJws ?? true;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.cacheBust = options.cacheBust ?? true;
    this.publicKey = options.publicKey ?? TSE_JWS_PUBLIC_KEY;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private ctx() {
    return { baseUrl: this.baseUrl, ambiente: this.ambiente };
  }

  private async fetchText(url: string): Promise<FetchTextResult | null> {
    const finalUrl = this.cacheBust
      ? `${url}${url.includes("?") ? "&" : "?"}nocache=${Date.now()}`
      : url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(finalUrl, {
        signal: controller.signal,
        headers: { accept: "application/json, text/plain, */*" },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new HttpError(
          `HTTP ${res.status} para ${finalUrl}`,
          res.status,
          finalUrl,
        );
      }
      const text = await res.text();
      return {
        text,
        etag: res.headers.get("etag"),
        lastModified: res.headers.get("last-modified"),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Busca e (opcionalmente) valida um arquivo. Sempre requisita a versão `.jws`
   * quando a verificação está ativa; caso contrário usa o `.json` puro.
   */
  private async fetchResource(
    pathWithExt: string,
  ): Promise<{ json: unknown; etag: string | null } | null> {
    if (this.verify) {
      const jwsPath = pathWithExt.replace(/\.json$/, ".jws");
      const raw = await this.fetchText(jwsPath);
      if (!raw) return null;
      let payload: string;
      try {
        payload = verifyJws(raw.text, this.publicKey);
      } catch (err) {
        if (err instanceof JwsError) throw err;
        throw new JwsError(String(err));
      }
      return { json: JSON.parse(payload), etag: raw.etag };
    }
    const raw = await this.fetchText(pathWithExt);
    if (!raw) return null;
    return { json: JSON.parse(raw.text), etag: raw.etag };
  }

  async getConfig(ciclo = "ele2026"): Promise<RawConfig> {
    void ciclo;
    const path = configPath("json", this.ctx());
    const res = await this.fetchResource(path);
    if (!res) throw new HttpError("Config do TSE não encontrado", 404, path);
    return configSchema.parse(res.json);
  }

  async getResultado(
    options: Omit<ResultadoFileOptions, "ext" | "ctx">,
  ): Promise<RawResultado | null> {
    const path = resultadoPath({ ...options, ext: "json", ctx: this.ctx() });
    const res = await this.fetchResource(path);
    if (!res) return null;
    return resultadoSchema.parse(res.json);
  }

  async getMunicipios(
    ciclo: string,
    cdEleicao: number,
  ): Promise<RawMunicipioFile | null> {
    const path = municipiosPath(ciclo, cdEleicao, "json", this.ctx());
    const res = await this.fetchResource(path);
    if (!res) return null;
    return municipioFileSchema.parse(res.json);
  }
}

/** Localiza um pleito pela sua sigla de ciclo (ex.: "ele2026"). */
export function findPleito(config: RawConfig, ciclo: string): RawConfigPleito | undefined {
  return config.pl.find((p) => p.c === ciclo);
}

/** Lista as eleições de um pleito. */
export function listEleicoes(pleito: RawConfigPleito | undefined): RawConfigEleicao[] {
  return pleito?.e ?? [];
}
