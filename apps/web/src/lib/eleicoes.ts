import { ELEICAO_2026, getCargo } from "@apuracao/shared";
import type { EleicaoResolvida, EleicoesResolvidas } from "@/lib/api";

/**
 * Eleições usadas enquanto o `/api/config` não responde. No 2º turno o coletor
 * devolve os códigos novos em poucos milissegundos; este fallback só evita que a
 * primeira renderização fique sem dados.
 */
export const ELEICOES_FALLBACK: EleicoesResolvidas = {
  ciclo: ELEICAO_2026.ciclo,
  // A Presidência já está no 2º turno. Não usamos o 1º turno como fallback para
  // não exibir candidatos/votação antigos enquanto o /api/config carrega.
  federal: {
    cd: ELEICAO_2026.eleicoes.federalSegundoTurno,
    turno: 2,
    data: `${ELEICAO_2026.dataSegundoTurno}T17:00:00-03:00`,
    nome: "Federal (2º turno)",
  },
  estadual: {
    cd: ELEICAO_2026.eleicoes.estadual,
    turno: 1,
    data: `${ELEICAO_2026.data}T17:00:00-03:00`,
    nome: "Estadual",
  },
  doConfig: false,
};

/**
 * Data da eleição presidencial atual. O config do TSE às vezes não traz `dt`
 * para o 2º turno; nesse caso usamos a data conhecida do calendário.
 */
export function dataPresidencial(eleicoes: EleicoesResolvidas): string | null {
  if (eleicoes.federal.data) return eleicoes.federal.data;
  return eleicoes.federal.turno > 1
    ? `${ELEICAO_2026.dataSegundoTurno}T17:00:00-03:00`
    : null;
}

/**
 * Código da eleição estadual de um cargo. Governador acompanha o turno atual
 * (2º turno, quando houver); Senador e Deputados continuam vindo do 1º turno —
 * é onde a vaga foi decidida e onde os dados seguem disponíveis.
 */
export function eleicaoEstadualDoCargo(
  eleicoes: EleicoesResolvidas,
  cargoCodigo: number | string,
): number {
  const atual = eleicoes.estadual;
  const primeiro = eleicoes.primeiroTurno?.estadual;
  if (!primeiro || atual.turno <= 1) return atual.cd;
  const cargo = getCargo(cargoCodigo);
  return cargo?.codigo === 3 ? atual.cd : primeiro.cd;
}

/**
 * Eleição de fallback do Governador: o 1º turno. Em um 2º turno, só os estados
 * com disputa têm arquivo na eleição nova; nos demais o resultado (já decidido)
 * continua no 1º turno.
 */
export function eleicaoEstadualFallback(
  eleicoes: EleicoesResolvidas,
  cargoCodigo: number | string,
): number | undefined {
  const primeiro = eleicoes.primeiroTurno?.estadual;
  if (!primeiro || getCargo(cargoCodigo)?.codigo !== 3) return undefined;
  return primeiro.cd !== eleicoes.estadual.cd ? primeiro.cd : undefined;
}

/** Eleição de onde vêm os municípios de uma UF (sempre a do 1º turno). */
export function eleicaoMunicipios(eleicoes: EleicoesResolvidas): number {
  return eleicoes.primeiroTurno?.estadual.cd ?? eleicoes.estadual.cd;
}

export type { EleicaoResolvida, EleicoesResolvidas };
