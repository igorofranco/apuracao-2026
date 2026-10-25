/** Escala do eixo Y do gráfico de evolução. */
export type EscalaGrafico = "relativo" | "absoluto";

/**
 * Domínio do eixo de percentuais.
 *
 * - `absoluto`: sempre 0–100%, independentemente dos dados;
 * - `relativo`: exatamente o menor e o maior percentual presentes na série.
 *
 * Quando todos os valores são iguais (série constante), o domínio ganha 1 ponto
 * de folga para o eixo não colapsar; nas pontas, a folga é limitada a 0–100%.
 */
export function dominioGrafico(
  valores: readonly number[],
  escala: EscalaGrafico,
): [number, number] {
  if (escala === "absoluto") return [0, 100];

  const validos = valores.filter((valor) => Number.isFinite(valor));
  if (validos.length === 0) return [0, 100];

  const min = Math.max(0, Math.min(...validos));
  const max = Math.min(100, Math.max(...validos));

  if (min === max) {
    if (min <= 0) return [0, 1];
    if (min >= 100) return [99, 100];
    return [min - 1, max + 1];
  }

  return [min, max];
}
