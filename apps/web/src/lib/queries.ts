"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ResultadoParams } from "./api";

export const resultadoKey = (p: ResultadoParams) =>
  ["resultado", p.eleicao, p.cargo, p.uf, p.municipio ?? "", p.zona ?? ""] as const;

export function useResumo() {
  return useQuery({
    queryKey: ["resumo"],
    queryFn: ({ signal }) => api.resumo(signal),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useResultado(params: ResultadoParams) {
  return useQuery({
    queryKey: resultadoKey(params),
    queryFn: ({ signal }) => api.resultado(params, signal),
    staleTime: 5_000,
    // Fallback de polling caso o SSE caia (o SSE faz updates imediatos via cache).
    refetchInterval: 30_000,
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
