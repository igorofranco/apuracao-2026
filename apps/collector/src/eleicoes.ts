import { ELEICAO_2026 } from "@apuracao/shared";
import { parseDataHora, type RawConfig, type RawConfigEleicao } from "@apuracao/domain";
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
  /** Eleição do turno atual (maior turno): Presidente/Governador no 2º turno. */
  federal: EleicaoResolvida;
  estadual: EleicaoResolvida;
  /**
   * Eleições do 1º turno, presentes quando o turno atual já é o 2º. É delas que
   * vêm os cargos decididos no 1º turno (Senador, Dep. Federal/Estadual/Distrital).
   */
  primeiroTurno?: {
    federal: EleicaoResolvida;
    estadual: EleicaoResolvida;
  };
  /** true quando os códigos vieram do config do TSE (não do fallback). */
  doConfig: boolean;
}

const turno = (e: RawConfigEleicao): number => Number(e.t ?? "1") || 1;

/**
 * Escolhe, por tipo de pleito (tp), a eleição de maior turno (padrão, cobre o
 * 2º turno) ou de menor turno (para localizar o 1º turno).
 */
function escolherPorTipo(
  lista: RawConfigEleicao[],
  tp: string,
  modo: "maior" | "menor" = "maior",
): RawConfigEleicao | undefined {
  const candidatas = lista.filter((e) => e.tp === tp);
  if (candidatas.length === 0) return undefined;
  return candidatas.reduce((a, b) =>
    modo === "maior"
      ? turno(b) > turno(a)
        ? b
        : a
      : turno(b) < turno(a)
        ? b
        : a,
  );
}

function acharPorCd(lista: RawConfigEleicao[], cd: number): RawConfigEleicao | undefined {
  return lista.find((e) => Number(e.cd) === cd);
}

function paraResolvida(e: RawConfigEleicao): EleicaoResolvida {
  return { cd: Number(e.cd), turno: turno(e), data: parseDataHora(e.dt, "17:00:00"), nome: e.nm ?? null };
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

    const federal = federalCfg ? paraResolvida(federalCfg) : fallback.federal;
    const estadual = estadualCfg ? paraResolvida(estadualCfg) : fallback.estadual;

    // 1º turno: quando o turno atual é o 2º, mantemos também a eleição anterior
    // para não perder os cargos já decididos (Senador, Deputados).
    const federal1Cfg = escolherPorTipo(eleicoes, "8", "menor");
    const estadual1Cfg = escolherPorTipo(eleicoes, "1", "menor");
    const primeiroTurno =
      federal.turno > 1 || estadual.turno > 1
        ? {
            federal: federal1Cfg ? paraResolvida(federal1Cfg) : federal,
            estadual: estadual1Cfg ? paraResolvida(estadual1Cfg) : estadual,
          }
        : undefined;

    const resolvidas: EleicoesResolvidas = {
      ciclo: config.tse.ciclo,
      federal,
      estadual,
      ...(primeiroTurno ? { primeiroTurno } : {}),
      doConfig: Boolean(federalCfg && estadualCfg),
    };
    log.info("eleições resolvidas do config do TSE", {
      federal: `${resolvidas.federal.cd} (turno ${resolvidas.federal.turno})`,
      estadual: `${resolvidas.estadual.cd} (turno ${resolvidas.estadual.turno})`,
      primeiroTurno: resolvidas.primeiroTurno
        ? `federal ${resolvidas.primeiroTurno.federal.cd} · estadual ${resolvidas.primeiroTurno.estadual.cd}`
        : "não se aplica",
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
