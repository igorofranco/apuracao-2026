import type { Snapshot, SnapshotCandidato } from "@apuracao/domain";

/** Candidato exibido no gráfico de evolução (dados do último snapshot). */
export interface CandidatoEvolucao {
  numero: string;
  nomeUrna: string;
  siglaPartido: string;
  percentual: number;
}

export interface EvolucaoRecortada {
  /** Amostras do "miolo útil", em ordem cronológica. */
  snapshots: Snapshot[];
  /** Candidatos exibidos, do mais votado para o menos votado. */
  candidatos: CandidatoEvolucao[];
  /** `true` quando o recorte removeu amostras do início e/ou do fim. */
  recortado: boolean;
}

/** No máximo 6 linhas para o gráfico continuar legível no card lateral. */
export const MAX_CANDIDATOS_EVOLUCAO = 6;

function candidatosDe(snapshot: Snapshot): SnapshotCandidato[] {
  return snapshot.candidatos ?? [];
}

/** Só entra no gráfico a amostra em que algum candidato já tem voto. */
function temDados(snapshot: Snapshot): boolean {
  return candidatosDe(snapshot).some((c) => c.votos > 0);
}

/**
 * Assinatura dos percentuais por candidato. Amostras consecutivas com a mesma
 * assinatura são consideradas repetidas (nada mudou para o eleitor).
 */
function assinatura(snapshot: Snapshot): string {
  return candidatosDe(snapshot)
    .map((c) => `${c.numero}:${c.percentual.toFixed(2)}`)
    .sort()
    .join("|");
}

/**
 * Recorta a série de snapshots para exibir apenas o trecho em que os
 * percentuais efetivamente mudam.
 *
 * - descarta amostras iniciais sem voto (ex.: geração antes da apuração);
 * - descarta a repetição inicial, mantendo um ponto de base antes da 1ª mudança;
 * - descarta a repetição final, mantendo o ponto em que o último valor mudou.
 *
 * Se não houver ao menos uma mudança, devolve uma série vazia — não faz sentido
 * desenhar uma linha reta "de 0 a 0" ou uma reta final estabilizada.
 */
export function recortarEvolucao(snapshots: Snapshot[]): EvolucaoRecortada {
  const uteis = snapshots.filter(temDados);
  const final = uteis.at(-1);

  if (!final || uteis.length < 2) {
    return { snapshots: [], candidatos: [], recortado: false };
  }

  const assinaturas = uteis.map(assinatura);

  let primeiraMudanca = -1;
  for (let i = 1; i < assinaturas.length; i++) {
    if (assinaturas[i] !== assinaturas[i - 1]) {
      primeiraMudanca = i;
      break;
    }
  }

  if (primeiraMudanca < 0) {
    // Série inteira constante: não há evolução para mostrar.
    return { snapshots: [], candidatos: [], recortado: true };
  }

  let ultimaMudanca = primeiraMudanca;
  for (let i = assinaturas.length - 1; i > 0; i--) {
    if (assinaturas[i] !== assinaturas[i - 1]) {
      ultimaMudanca = i;
      break;
    }
  }

  // Um ponto de base antes da 1ª mudança (se for uma amostra com dados) e o
  // ponto exato da última mudança. O resto do início/fim repetido é descartado.
  const inicio = Math.max(0, primeiraMudanca - 1);
  const recortados = uteis.slice(inicio, ultimaMudanca + 1);

  const candidatos = candidatosDe(final)
    .slice()
    .sort((a, b) => b.percentual - a.percentual || a.nomeUrna.localeCompare(b.nomeUrna, "pt-BR"))
    .slice(0, MAX_CANDIDATOS_EVOLUCAO)
    .map((c) => ({
      numero: c.numero,
      nomeUrna: c.nomeUrna,
      siglaPartido: c.siglaPartido,
      percentual: c.percentual,
    }));

  return {
    snapshots: recortados,
    candidatos,
    recortado: recortados.length < snapshots.length,
  };
}
