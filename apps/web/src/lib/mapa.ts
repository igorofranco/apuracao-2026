/**
 * Utilidades dos mapas: paleta do heatmap de apuração e escala do mapa
 * presidencial (Lula × Flávio).
 *
 * Fica em `lib/` para ser reaproveitada tanto pelo mapa quanto pela legenda de
 * gradiente e pelos testes unitários.
 */

const DE = [226, 230, 238] as const;
const ATE = [34, 201, 138] as const;

/** Cor do estado para um percentual de apuração (0–100). */
export function corApuracao(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  const c = DE.map((f, i) => Math.round(f + (ATE[i]! - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* -------------------------- Mapa presidencial ---------------------------- */

/** Candidato exibido no mapa (cor = cor do partido, na ordem do gradiente). */
export interface CandidatoMapa {
  numero: string;
  nomeUrna: string;
  siglaPartido: string;
  cor: string;
}

/** Votação dos dois candidatos em uma UF. */
export interface EstadoMapa {
  uf: string;
  votosA: number;
  votosB: number;
}

/** Cor neutra do gradiente (empate / sem dados). */
export const COR_NEUTRA = "#e4e9f2";

/**
 * Paleta do gradiente:
 * - `neutro`: azul → cor neutra → vermelho (o empate fica claro);
 * - `direto`: azul → vermelho, sem cor neutra no meio (o empate fica no
 *   meio-termo entre as duas cores).
 */
export type ModoCores = "neutro" | "direto";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  const completo =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return [
    parseInt(completo.slice(0, 2), 16),
    parseInt(completo.slice(2, 4), 16),
    parseInt(completo.slice(4, 6), 16),
  ];
}

function misturar(
  de: [number, number, number],
  ate: [number, number, number],
  t: number,
): string {
  const c = de.map((v, i) => Math.round(v + (ate[i]! - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * Percentual do candidato A entre os votos dos dois candidatos (0–100).
 * `null` quando a UF ainda não tem nenhum voto computado.
 */
export function percentualEntreDois(
  votosA: number,
  votosB: number,
): number | null {
  const total = votosA + votosB;
  if (total <= 0) return null;
  return (votosA / total) * 100;
}

/**
 * Escala absoluta: posição no gradiente a partir da diferença real entre os
 * candidatos. -1 = 100% no B (azul), 0 = empate, +1 = 100% no A (vermelho).
 * Um estado 60% × 40% fica 20% do caminho para o vermelho.
 */
export function posicaoAbsoluta(votosA: number, votosB: number): number {
  const total = votosA + votosB;
  if (total <= 0) return 0;
  return clamp((votosA - votosB) / total, -1, 1);
}

/**
 * Escala relativa: normaliza os percentuais das UFs com votos entre o estado
 * mais favorável ao B (-1, azul total) e o mais favorável ao A (+1, vermelho
 * total). Assim os dois extremos do país ocupam as pontas da paleta.
 */
export function posicoesRelativas(percentuais: number[]): number[] {
  if (percentuais.length === 0) return [];
  const min = Math.min(...percentuais);
  const max = Math.max(...percentuais);
  if (max === min) return percentuais.map(() => 0);
  return percentuais.map((p) => ((p - min) / (max - min)) * 2 - 1);
}

/**
 * Cor do estado no gradiente.
 *
 * No modo `neutro`, parte do neutro e interpola para a cor do candidato
 * proporcionalmente à posição (com leve curva para os tons médios não ficarem
 * apagados). No modo `direto`, percorre linearmente o gradiente entre as duas
 * cores dos candidatos, sem passar pelo neutro.
 */
export function corMapaPresidente(
  posicao: number,
  corA: string,
  corB: string,
  modo: ModoCores = "neutro",
): string {
  const t = clamp(Number.isFinite(posicao) ? posicao : 0, -1, 1);
  if (modo === "direto") {
    return misturar(hexParaRgb(corB), hexParaRgb(corA), (t + 1) / 2);
  }
  if (t === 0) return COR_NEUTRA;
  const alvo = t > 0 ? corA : corB;
  const forca = Math.pow(Math.abs(t), 0.9);
  return misturar(hexParaRgb(COR_NEUTRA), hexParaRgb(alvo), forca);
}
