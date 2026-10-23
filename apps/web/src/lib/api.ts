import type {
  Municipio,
  RaceResult,
  RaceSummary,
  Snapshot,
} from "@apuracao/domain";
import { withEleicaoMatematica } from "@apuracao/domain";
import type { Cargo, Uf } from "@apuracao/shared";

// Mesma origem por padrão (nginx proxya /api para o collector em produção).
// Em dev, defina NEXT_PUBLIC_API_URL=http://localhost:8787 (veja .env.example).
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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

/** Eleição resolvida pelo coletor (código e turno atuais). */
export interface EleicaoResolvida {
  cd: number;
  turno: number;
  /** Data de início da apuração (ISO), quando conhecida. */
  data: string | null;
  nome: string | null;
}

/**
 * Eleições resolvidas do config do TSE. `federal`/`estadual` apontam para o
 * turno atual (2º, quando houver); `primeiroTurno` guarda as eleições anteriores,
 * de onde vêm Senador e Deputados.
 */
export interface EleicoesResolvidas {
  ciclo: string;
  federal: EleicaoResolvida;
  estadual: EleicaoResolvida;
  primeiroTurno?: {
    federal: EleicaoResolvida;
    estadual: EleicaoResolvida;
  };
  doConfig: boolean;
}

export interface ResumoResponse {
  eleicao: EleicoesResolvidas;
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

/** Votação presidencial de um município (mapa do 2º turno). */
export interface MunicipioPresidenteResumo {
  cd: string;
  cdi: string | null;
  nome: string;
  uf: string;
  votos: Record<string, number>;
  votosValidos: number;
  semDados: boolean;
  atualizadoEm: string;
}

/**
 * Snapshot da coleta municipal do presidente. É alimentado em segundo plano
 * pelo collector; `coletados < total` indica que o mapa ainda está enchendo.
 */
export interface MunicipiosPresidenteResponse {
  eleicao: number;
  cargo: number;
  uf: string;
  total: number;
  coletados: number;
  preparando: boolean;
  /** true quando a coleta municipal está desligada no collector. */
  desabilitado?: boolean;
  atualizadoEm: string | null;
  municipios: MunicipioPresidenteResumo[];
}

/** Progresso por UF dentro do snapshot nacional. */
export interface MunicipiosPresidentePorUf {
  total: number;
  coletados: number;
  atualizadoEm: string | null;
}

/**
 * Snapshot nacional compacto do mapa do 2º turno. Cada município é uma tupla
 * `[cdi, uf, votosA, votosB]`; o servidor já monta e cacheia o payload.
 */
export interface MunicipiosPresidenteBrasilResponse {
  eleicao: number;
  cargo: number;
  candidatos: [string, string];
  total: number;
  coletados: number;
  preparando: boolean;
  revisao: number;
  ciclos: number;
  /** false antes da liberação hardcoded (domingo, 25/10, 16h). */
  liberado?: boolean;
  /** true quando a coleta municipal está desligada no collector. */
  desabilitado?: boolean;
  atualizadoEm: string | null;
  porUf: Record<string, MunicipiosPresidentePorUf>;
  municipios: Array<[string, string, number, number]>;
}

export interface ConfigResponse {
  eleicao: EleicoesResolvidas;
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
  resultado: async (params: ResultadoParams, signal?: AbortSignal) =>
    // Deriva a eleição matemática no cliente também, para a UI ficar correta
    // mesmo com um backend que não calcule a flag (ex.: mock dos testes).
    withEleicaoMatematica(
      await getJson<RaceResult>(`/api/resultado${qs(params)}`, signal),
    ),
  historico: (
    params: Pick<ResultadoParams, "eleicao" | "cargo" | "uf">,
    signal?: AbortSignal,
  ) => getJson<HistoricoResponse>(`/api/historico${qs(params)}`, signal),
  municipios: (
    params: { eleicao: number; uf: string },
    signal?: AbortSignal,
  ) => getJson<MunicipiosResponse>(`/api/municipios${qs(params)}`, signal),
  presidenteMunicipios: (
    params: { eleicao: number; uf: string },
    signal?: AbortSignal,
  ) =>
    getJson<MunicipiosPresidenteResponse>(
      `/api/presidente/municipios${qs(params)}`,
      signal,
    ),
  presidenteMunicipiosBrasil: (
    params: { eleicao: number; a: string; b: string },
    signal?: AbortSignal,
  ) =>
    getJson<MunicipiosPresidenteBrasilResponse>(
      `/api/presidente/municipios${qs(params)}`,
      signal,
    ),
};

export type {
  Municipio,
  RaceResult,
  RaceSummary,
  Snapshot,
};
