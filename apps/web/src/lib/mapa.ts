/**
 * Paleta do heatmap de apuração do mapa.
 *
 * Interpola do cinza-azulado (pouco apurado, menos destacado) ao verde
 * (muito apurado, mais destacado). Fica em `lib/` para ser reaproveitada
 * tanto pelo mapa quanto pela legenda de gradiente.
 */

const DE = [226, 230, 238] as const;
const ATE = [34, 201, 138] as const;

/** Cor do estado para um percentual de apuração (0–100). */
export function corApuracao(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  const c = DE.map((f, i) => Math.round(f + (ATE[i]! - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
