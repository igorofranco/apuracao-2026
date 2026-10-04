"use client";

import { useCallback, useEffect, useState } from "react";
import { ELEICAO_2026, cargosDaUf, getCargo, getUf, isUf } from "@apuracao/shared";

/** Uma corrida (cargo + UF) fixada no painel personalizado. */
export interface CorridaFixada {
  /** Código TSE do cargo (1 = Presidente). */
  cargo: number;
  /** Sigla da UF; "br" para cargos nacionais (Presidente). */
  uf: string;
}

/** Quantidade de candidatos exibidos por corrida. */
export type TopN = 3 | 5;

export interface PainelConfig {
  itens: CorridaFixada[];
  topN: TopN;
}

export const PAINEL_STORAGE_KEY = "apuracao-painel";
export const PAINEL_PADRAO: PainelConfig = { itens: [], topN: 3 };
export const TOPS_DISPONIVEIS: readonly TopN[] = [3, 5];

/** Chave única de uma corrida (mesma ideia usada pelo store do collector). */
export function chaveCorrida(c: CorridaFixada): string {
  return `${c.cargo}:${c.uf}`;
}

/** Código da eleição correspondente ao cargo (federal x estadual). */
export function eleicaoDoCargo(cargo: number): number {
  return cargo === 1 ? ELEICAO_2026.eleicoes.federal : ELEICAO_2026.eleicoes.estadual;
}

/** Rótulo legível de uma corrida: "Governador · Minas Gerais" / "Presidente · Brasil". */
export function rotuloCorrida(c: CorridaFixada): { titulo: string; local: string } {
  const cargo = getCargo(c.cargo);
  const titulo = cargo?.curto ?? `Cargo ${c.cargo}`;
  if (cargo?.abrangencia === "federal" || c.uf === "br") {
    return { titulo, local: "Brasil" };
  }
  const uf = getUf(c.uf);
  return { titulo, local: uf ? uf.nome : c.uf.toUpperCase() };
}

/** Link para a página completa de uma corrida. */
export function hrefCorrida(c: CorridaFixada): string {
  const cargo = getCargo(c.cargo);
  if (cargo?.abrangencia === "federal" || c.uf === "br") return "/presidente";
  return `/uf/${c.uf}?cargo=${c.cargo}`;
}

/**
 * Uma corrida é válida quando o cargo existe e a UF é compatível com a
 * abrangência (Presidente é sempre "br"; cargos estaduais precisam existir na UF,
 * o que exclui, por exemplo, Dep. Estadual no DF e Dep. Distrital fora do DF).
 */
export function corridaValida(c: CorridaFixada): boolean {
  const cargo = getCargo(c.cargo);
  if (!cargo) return false;
  if (cargo.abrangencia === "federal") return c.uf === "br";
  if (!isUf(c.uf)) return false;
  return cargosDaUf(c.uf).some((k) => k.codigo === cargo.codigo);
}

/** Adiciona uma corrida evitando duplicatas e entradas inválidas. */
export function adicionarCorrida(
  itens: CorridaFixada[],
  corrida: CorridaFixada,
): CorridaFixada[] {
  if (!corridaValida(corrida)) return itens;
  if (itens.some((i) => chaveCorrida(i) === chaveCorrida(corrida))) return itens;
  return [...itens, corrida];
}

/** Remove uma corrida pela chave. */
export function removerCorrida(
  itens: CorridaFixada[],
  alvo: CorridaFixada,
): CorridaFixada[] {
  return itens.filter((i) => chaveCorrida(i) !== chaveCorrida(alvo));
}

/** Move uma corrida uma posição acima (-1) ou abaixo (+1). */
export function moverCorrida(
  itens: CorridaFixada[],
  alvo: CorridaFixada,
  direcao: -1 | 1,
): CorridaFixada[] {
  const idx = itens.findIndex((i) => chaveCorrida(i) === chaveCorrida(alvo));
  if (idx < 0) return itens;
  const destino = idx + direcao;
  if (destino < 0 || destino >= itens.length) return itens;
  const copia = [...itens];
  const a = copia[idx];
  const b = copia[destino];
  if (!a || !b) return itens;
  copia[idx] = b;
  copia[destino] = a;
  return copia;
}

/** Normaliza um valor desconhecido (do localStorage) em uma config válida. */
export function sanitizarConfig(valor: unknown): PainelConfig {
  if (!valor || typeof valor !== "object") return PAINEL_PADRAO;
  const bruto = valor as { itens?: unknown; topN?: unknown };
  const itens: CorridaFixada[] = [];
  const vistos = new Set<string>();
  if (Array.isArray(bruto.itens)) {
    for (const item of bruto.itens) {
      if (!item || typeof item !== "object") continue;
      const { cargo, uf } = item as { cargo?: unknown; uf?: unknown };
      const corrida: CorridaFixada = { cargo: Number(cargo), uf: String(uf ?? "").toLowerCase() };
      if (!corridaValida(corrida)) continue;
      const chave = chaveCorrida(corrida);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      itens.push(corrida);
    }
  }
  const topN: TopN = TOPS_DISPONIVEIS.includes(Number(bruto.topN) as TopN)
    ? (Number(bruto.topN) as TopN)
    : PAINEL_PADRAO.topN;
  return { itens, topN };
}

function lerConfig(): PainelConfig {
  try {
    const raw = localStorage.getItem(PAINEL_STORAGE_KEY);
    if (!raw) return PAINEL_PADRAO;
    return sanitizarConfig(JSON.parse(raw));
  } catch {
    return PAINEL_PADRAO;
  }
}

/**
 * Estado do painel personalizado, persistido em `localStorage` (só no cliente).
 * `pronto` indica que a leitura inicial terminou — antes disso, renderize um
 * placeholder para não divergir do HTML do servidor.
 */
export function usePainel() {
  const [config, setConfig] = useState<PainelConfig>(PAINEL_PADRAO);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setConfig(lerConfig());
    setPronto(true);

    const aoMudarStorage = (event: StorageEvent) => {
      if (event.key === PAINEL_STORAGE_KEY) setConfig(lerConfig());
    };
    window.addEventListener("storage", aoMudarStorage);
    return () => window.removeEventListener("storage", aoMudarStorage);
  }, []);

  const persistir = useCallback((proximo: PainelConfig) => {
    const limpo = sanitizarConfig(proximo);
    setConfig(limpo);
    try {
      localStorage.setItem(PAINEL_STORAGE_KEY, JSON.stringify(limpo));
    } catch {
      // storage indisponível (modo privado); mantém só em memória
    }
  }, []);

  const adicionar = useCallback(
    (corrida: CorridaFixada) =>
      persistir({ ...config, itens: adicionarCorrida(config.itens, corrida) }),
    [config, persistir],
  );
  const adicionarVarias = useCallback(
    (corridas: CorridaFixada[]) => {
      let itens = config.itens;
      for (const corrida of corridas) itens = adicionarCorrida(itens, corrida);
      persistir({ ...config, itens });
    },
    [config, persistir],
  );
  const remover = useCallback(
    (corrida: CorridaFixada) =>
      persistir({ ...config, itens: removerCorrida(config.itens, corrida) }),
    [config, persistir],
  );
  const mover = useCallback(
    (corrida: CorridaFixada, direcao: -1 | 1) =>
      persistir({ ...config, itens: moverCorrida(config.itens, corrida, direcao) }),
    [config, persistir],
  );
  const setTopN = useCallback(
    (topN: TopN) => persistir({ ...config, topN }),
    [config, persistir],
  );
  const limpar = useCallback(() => persistir(PAINEL_PADRAO), [persistir]);

  return { pronto, config, adicionar, adicionarVarias, remover, mover, setTopN, limpar };
}
