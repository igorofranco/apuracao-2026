import { ELEICAO_2026 } from "@apuracao/shared";
import type { RawConfig, RawConfigEleicao } from "@apuracao/domain";
import { findPleito, listEleicoes, type TseClient } from "@apuracao/tse-client";
import type { CollectorConfig } from "./config.ts";
import type { Logger } from "./logger.ts";

export interface EleicaoResolvida {
  cd: number;
  turno: number;
  /** Data no formato DD/MM/AAAA, se conhecida. */
  data: string | null;
  nome: string | null;
}

export interface EleicoesResolvidas {
  ciclo: string;
  federal: EleicaoResolvida;
  estadual: EleicaoResolvida;
  /** true quando os códigos vieram do config do TSE (não do fallback). */
  doConfig: boolean;
}

const turno = (e: RawConfigEleicao): number => Number(e.t ?? "1") || 1;
const dataIso = (ddmmaaaa: string | undefined): string | null => {
  if (!ddmmaaaa || !/^\d{2}\/\d{2}\/\d{4}$/.test(ddmmaaaa)) return null;
  const [d, m, y] = ddmmaaaa.split("/");
  return `${y}-${m}-${d}T17:00:00-03:00`;
};

/** Escolhe, por tipo de pleito (tp), a eleição de maior turno (cobre 2º turno). */
function escolherPorTipo(lista: RawConfigEleicao[], tp: string): RawConfigEleicao | undefined {
  const candidatas = lista.filter((e) => e.tp === tp);
  if (candidatas.length === 0) return undefined;
  return candidatas.reduce((a, b) => (turno(b) > turno(a) ? b : a));
}

function acharPorCd(lista: RawConfigEleicao[], cd: number): RawConfigEleicao | undefined {
  return lista.find((e) => Number(e.cd) === cd);
}

function paraResolvida(e: RawConfigEleicao): EleicaoResolvida {
  return { cd: Number(e.cd), turno: turno(e), data: dataIso(e.dt), nome: e.nm ?? null };
}

/**
 * Resolve os códigos de eleição (federal/Presidente e estadual) a partir do
 * config oficial do TSE. Assim o 2º turno entra sozinho quando o TSE publicar
 * uma nova eleição (maior turno) para o mesmo pleito.
 */
export async function resolverEleicoes(
  client: TseClient,
  config: CollectorConfig,
  log: Logger,
): Promise<EleicoesResolvidas> {
  const fallback: EleicoesResolvidas = {
    ciclo: config.tse.ciclo,
    federal: {
      cd: config.tse.eleicaoFederal ?? ELEICAO_2026.eleicoes.federal,
      turno: 1,
      data: `${ELEICAO_2026.data}T17:00:00-03:00`,
      nome: "Federal (fallback)",
    },
    estadual: {
      cd: config.tse.eleicaoEstadual ?? ELEICAO_2026.eleicoes.estadual,
      turno: 1,
      data: `${ELEICAO_2026.data}T17:00:00-03:00`,
      nome: "Estadual (fallback)",
    },
    doConfig: false,
  };

  if (!config.tse.resolverEleicoes) return fallback;

  try {
    const raw: RawConfig = await client.getConfig(config.tse.ciclo);
    const pleito = findPleito(raw, config.tse.ciclo);
    const eleicoes = listEleicoes(pleito);
    if (eleicoes.length === 0) return fallback;

    const federalCfg = config.tse.eleicaoFederal
      ? acharPorCd(eleicoes, config.tse.eleicaoFederal)
      : escolherPorTipo(eleicoes, "8");
    const estadualCfg = config.tse.eleicaoEstadual
      ? acharPorCd(eleicoes, config.tse.eleicaoEstadual)
      : escolherPorTipo(eleicoes, "1");

    const resolvidas: EleicoesResolvidas = {
      ciclo: config.tse.ciclo,
      federal: federalCfg ? paraResolvida(federalCfg) : fallback.federal,
      estadual: estadualCfg ? paraResolvida(estadualCfg) : fallback.estadual,
      doConfig: Boolean(federalCfg && estadualCfg),
    };
    log.info("eleições resolvidas do config do TSE", {
      federal: `${resolvidas.federal.cd} (turno ${resolvidas.federal.turno})`,
      estadual: `${resolvidas.estadual.cd} (turno ${resolvidas.estadual.turno})`,
    });
    return resolvidas;
  } catch (err) {
    log.warn("não foi possível resolver eleições do config; usando fallback", {
      erro: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

/**
 * Predicado de "apuração ativa": dentro da janela de qualquer eleição resolvida
 * (17h do dia do pleito até ~15h depois, em horário de Brasília).
 */
export function estaEmApuracao(
  eleicoes: EleicoesResolvidas,
  now = new Date(),
): boolean {
  const janelas = [eleicoes.federal.data, eleicoes.estadual.data]
    .filter((d): d is string => Boolean(d))
    .map((iso) => {
      const inicio = new Date(iso).getTime();
      return { inicio, fim: inicio + 15 * 60 * 60 * 1000 };
    });
  if (janelas.length === 0) return false;
  const t = now.getTime();
  return janelas.some((j) => t >= j.inicio && t <= j.fim);
}
