import type {
  Municipio,
  RaceResult,
  RaceSummary,
  Snapshot,
} from "@apuracao/domain";
import type { Cargo, Uf } from "@apuracao/shared";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    throw new ApiError(`Falha ao buscar ${path} (HTTP ${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export interface ResumoResponse {
  eleicao: unknown;
  total: number;
  corridas: RaceSummary[];
}

export interface HistoricoResponse {
  eleicao: number;
  cargo: number;
  uf: string;
  snapshots: Snapshot[];
}

export interface MunicipiosResponse {
  eleicao: number;
  uf: string;
  total: number;
  municipios: Municipio[];
}

export interface ConfigResponse {
  eleicao: unknown;
  ufs: Uf[];
  cargos: Cargo[];
}

export interface ResultadoParams {
  eleicao: number;
  cargo: number;
  uf: string;
  municipio?: string;
  zona?: string;
}

const qs = (params: object): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const api = {
  resumo: (signal?: AbortSignal) => getJson<ResumoResponse>("/api/resumo", signal),
  config: (signal?: AbortSignal) => getJson<ConfigResponse>("/api/config", signal),
  resultado: (params: ResultadoParams, signal?: AbortSignal) =>
    getJson<RaceResult>(`/api/resultado${qs(params)}`, signal),
  historico: (
    params: Pick<ResultadoParams, "eleicao" | "cargo" | "uf">,
    signal?: AbortSignal,
  ) => getJson<HistoricoResponse>(`/api/historico${qs(params)}`, signal),
  municipios: (
    params: { eleicao: number; uf: string },
    signal?: AbortSignal,
  ) => getJson<MunicipiosResponse>(`/api/municipios${qs(params)}`, signal),
};

export type {
  Municipio,
  RaceResult,
  RaceSummary,
  Snapshot,
};
