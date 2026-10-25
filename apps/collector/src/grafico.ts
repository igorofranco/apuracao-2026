import type { Snapshot } from "@apuracao/domain";

/** Candidato de uma linha do gráfico (os dois mais votados do 2º turno). */
export interface GraficoCandidato {
  numero: string;
  nomeUrna: string;
  siglaPartido: string;
}

/** Um ponto da série: percentual de cada candidato em um instante. */
export interface GraficoPonto {
  /** Instante da captura (ISO). */
  em: string;
  /** Percentual das seções já totalizadas naquele momento. */
  percentualApurado: number;
  /** Percentual dos votos válidos por número de candidato. */
  percentuais: Record<string, number | null>;
}

export interface GraficoEvolucao {
  eleicao: number;
  cargo: number;
  uf: string;
  /** Até 2 candidatos (o gráfico é desenhado com uma linha por candidato). */
  candidatos: GraficoCandidato[];
  pontos: GraficoPonto[];
  /** `true` quando o início sem dados e/ou o fim repetido foram removidos. */
  recortado: boolean;
  /** Total de amostras disponíveis antes do recorte. */
  amostras: number;
  /** Instante da última captura (mesmo que ela tenha sido recortada). */
  atualizadoEm: string | null;
}

export interface ParametrosGrafico {
  eleicao: number;
  cargo: number;
  uf: string;
}

export interface OpcoesGrafico {
  /**
   * Máximo de pontos no payload. A série é reduzida uniformemente, preservando
   * o primeiro e o último ponto (o suficiente para desenhar o gráfico).
   */
  maxPontos?: number;
}

/** O gráfico do 2º turno tem exatamente duas linhas. */
const MAX_CANDIDATOS = 2;
const MAX_PONTOS_PADRAO = 400;

function temDados(snapshot: Snapshot): boolean {
  return (snapshot.candidatos ?? []).some((c) => c.votos > 0);
}

/**
 * Os dois candidatos que aparecem no gráfico: os mais votados do último
 * snapshot com dados. Em empate, o nome de urna desempata para a série ficar
 * determinística entre requisições.
 */
function selecionarCandidatos(snapshot: Snapshot): GraficoCandidato[] {
  return [...(snapshot.candidatos ?? [])]
    .filter((c) => c.numero && c.nomeUrna)
    .sort(
      (a, b) =>
        b.votos - a.votos || a.nomeUrna.localeCompare(b.nomeUrna, "pt-BR"),
    )
    .slice(0, MAX_CANDIDATOS)
    .map((c) => ({
      numero: c.numero,
      nomeUrna: c.nomeUrna,
      siglaPartido: c.siglaPartido,
    }));
}

/**
 * Assinatura dos percentuais das linhas do gráfico. Amostras consecutivas com
 * a mesma assinatura são consideradas repetidas (nada mudou para o eleitor).
 */
function assinatura(
  snapshot: Snapshot,
  candidatos: GraficoCandidato[],
): string {
  return candidatos
    .map((candidato) => {
      const encontrado = snapshot.candidatos?.find(
        (c) => c.numero === candidato.numero,
      );
      return encontrado ? encontrado.percentual.toFixed(2) : "-";
    })
    .join("|");
}

/** Reduz a série sem perder as pontas, mantendo o desenho fiel ao período. */
function reduzirPontos(
  pontos: GraficoPonto[],
  maxPontos: number | undefined,
): GraficoPonto[] {
  const limite = Math.max(2, Math.floor(maxPontos ?? MAX_PONTOS_PADRAO));
  if (pontos.length <= limite) return pontos;

  const passo = (pontos.length - 1) / (limite - 1);
  const reduzidos: GraficoPonto[] = [];
  let anterior = -1;
  for (let i = 0; i < limite; i++) {
    const indice = Math.round(i * passo);
    if (indice === anterior) continue;
    const ponto = pontos[indice];
    if (ponto) reduzidos.push(ponto);
    anterior = indice;
  }
  const ultimo = pontos.at(-1);
  if (ultimo && reduzidos.at(-1) !== ultimo) reduzidos.push(ultimo);
  return reduzidos;
}

function pontoDe(
  snapshot: Snapshot,
  candidatos: GraficoCandidato[],
): GraficoPonto {
  const percentuais: Record<string, number | null> = {};
  for (const candidato of candidatos) {
    const encontrado = snapshot.candidatos?.find(
      (c) => c.numero === candidato.numero,
    );
    percentuais[candidato.numero] = encontrado?.percentual ?? null;
  }
  return {
    em: snapshot.capturadoEm,
    percentualApurado: snapshot.percentualApurado,
    percentuais,
  };
}

/**
 * Monta o payload do gráfico de evolução a partir dos snapshots do collector.
 *
 * Recortes (feitos no servidor, uma vez por mudança de snapshot):
 * - amostras iniciais sem nenhum voto são descartadas;
 * - a repetição inicial é colapsada em um único ponto de base;
 * - a repetição final (percentuais estáveis, inclusive depois de a apuração
 *   chegar a 100%) é descartada, mantendo o instante da última mudança.
 *
 * A série é então reduzida para `maxPontos` para o payload não crescer sem
 * limite ao longo de uma apuração de várias horas.
 */
export function construirGrafico(
  parametros: ParametrosGrafico,
  snapshots: Snapshot[],
  opcoes: OpcoesGrafico = {},
): GraficoEvolucao {
  const vazio = (
    candidatos: GraficoCandidato[] = [],
  ): GraficoEvolucao => ({
    eleicao: parametros.eleicao,
    cargo: parametros.cargo,
    uf: parametros.uf,
    candidatos,
    pontos: [],
    recortado: snapshots.length > 0,
    amostras: snapshots.length,
    atualizadoEm: snapshots.at(-1)?.capturadoEm ?? null,
  });

  const uteis = snapshots.filter(temDados);
  const ultimo = uteis.at(-1);
  if (!ultimo) return vazio();

  const candidatos = selecionarCandidatos(ultimo);
  if (candidatos.length === 0) return vazio();

  const assinaturas = uteis.map((snapshot) => assinatura(snapshot, candidatos));

  let primeiraMudanca = -1;
  for (let i = 1; i < assinaturas.length; i++) {
    if (assinaturas[i] !== assinaturas[i - 1]) {
      primeiraMudanca = i;
      break;
    }
  }

  // Série constante: não há linha para desenhar. Mantemos os candidatos para
  // a interface explicar o estado de espera.
  if (primeiraMudanca < 0) {
    return {
      ...vazio(candidatos),
      recortado: true,
    };
  }

  let ultimaMudanca = primeiraMudanca;
  for (let i = assinaturas.length - 1; i > 0; i--) {
    if (assinaturas[i] !== assinaturas[i - 1]) {
      ultimaMudanca = i;
      break;
    }
  }

  // Um ponto de base antes da 1ª mudança + o ponto exato da última mudança.
  const inicio = Math.max(0, primeiraMudanca - 1);
  const recortados = uteis.slice(inicio, ultimaMudanca + 1);
  const pontos = reduzirPontos(
    recortados.map((snapshot) => pontoDe(snapshot, candidatos)),
    opcoes.maxPontos,
  );

  return {
    eleicao: parametros.eleicao,
    cargo: parametros.cargo,
    uf: parametros.uf,
    candidatos,
    pontos,
    recortado: recortados.length < snapshots.length,
    amostras: snapshots.length,
    atualizadoEm: snapshots.at(-1)?.capturadoEm ?? null,
  };
}
