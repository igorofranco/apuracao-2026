"use client";

import { useQuery } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type EleicoesResolvidas,
  type ResultadoParams,
} from "./api";
import {
  ELEICOES_FALLBACK,
  eleicaoEstadualDoCargo,
  eleicaoEstadualFallback,
} from "./eleicoes";

export const resultadoKey = (p: ResultadoParams) =>
  ["resultado", p.eleicao, p.cargo, p.uf, p.municipio ?? "", p.zona ?? ""] as const;

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: ({ signal }) => api.config(signal),
    // Os códigos de eleição só mudam quando o TSE publica um novo turno.
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

/** Eleições do turno atual, resolvidas pelo coletor a partir do config do TSE. */
export function useEleicoes(): EleicoesResolvidas {
  const config = useConfig();
  return config.data?.eleicao ?? ELEICOES_FALLBACK;
}

/**
 * Resultado de um cargo estadual. Governador tenta primeiro a eleição do turno
 * atual (2º turno) e cai para o 1º turno quando o estado não teve 2º turno.
 */
export function useResultadoEstadual(
  eleicoes: EleicoesResolvidas,
  params: { cargo: number; uf: string; municipio?: string; zona?: string },
  options?: { enabled?: boolean },
) {
  const eleicao = eleicaoEstadualDoCargo(eleicoes, params.cargo);
  const fallback = eleicaoEstadualFallback(eleicoes, params.cargo);
  return useQuery({
    queryKey: resultadoKey({ eleicao, ...params }),
    queryFn: async ({ signal }) => {
      try {
        return await api.resultado({ eleicao, ...params }, signal);
      } catch (err) {
        if (fallback == null) throw err;
        if (err instanceof ApiError && err.status === 404) {
          return api.resultado({ eleicao: fallback, ...params }, signal);
        }
        throw err;
      }
    },
    staleTime: 5_000,
    refetchInterval: 30_000,
    ...options,
  });
}

export function useResumo() {
  return useQuery({
    queryKey: ["resumo"],
    queryFn: ({ signal }) => api.resumo(signal),
    // O poller lento (mapa por UF/governadores) atualiza a cada 60 s; o SSE
    // antecipa a atualização quando alguma corrida muda.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useResultado(
  params: ResultadoParams,
  options?: { retry?: number | boolean; enabled?: boolean },
) {
  return useQuery({
    queryKey: resultadoKey(params),
    queryFn: ({ signal }) => api.resultado(params, signal),
    staleTime: 5_000,
    // Fallback de polling caso o SSE caia (o SSE faz updates imediatos via cache).
    refetchInterval: 30_000,
    ...options,
  });
}

export function useHistorico(
  params: Pick<ResultadoParams, "eleicao" | "cargo" | "uf">,
) {
  return useQuery({
    queryKey: ["historico", params.eleicao, params.cargo, params.uf],
    queryFn: ({ signal }) => api.historico(params, signal),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useMunicipios(params: { eleicao: number; uf: string }) {
  return useQuery({
    queryKey: ["municipios", params.eleicao, params.uf],
    queryFn: ({ signal }) => api.municipios(params, signal),
    staleTime: 30 * 60_000,
  });
}

/**
 * Snapshot nacional do presidente por município. O collector monta e cacheia o
 * payload no servidor; o browser faz **uma** requisição (com ETag/cache) e usa
 * os mesmos dados para a visão Brasil e para o drill-down da UF.
 *
 * Enquanto a primeira varredura enche, atualiza a cada 30 s; depois, a cada
 * 5 min (e imediatamente quando o SSE avisa que um ciclo terminou).
 */
export function useMunicipiosPresidenteBrasil(params: {
  eleicao: number;
  a: string;
  b: string;
}) {
  return useQuery({
    queryKey: ["presidente-municipios", params.eleicao, params.a, params.b],
    queryFn: ({ signal }) => api.presidenteMunicipiosBrasil(params, signal),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 30_000;
      if (data.desabilitado) return false;
      if (data.liberado === false) return 60_000;
      return data.preparando || data.total === 0 || data.coletados < data.total
        ? 30_000
        : 5 * 60_000;
    },
    retry: 1,
  });
}
