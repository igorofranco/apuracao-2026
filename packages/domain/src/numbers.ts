/**
 * Conversores tolerantes dos campos do TSE. Os arquivos misturam números e
 * strings ("1.234", "50,00"), então as regras ficam em um único lugar, usadas
 * tanto pelos schemas Zod (`raw.ts`) quanto pela normalização (`normalize.ts`).
 */

/** Converte "s"/"S" em true; qualquer outra coisa em false. */
export function toBool(value: string | undefined | null): boolean {
  return (value ?? "").trim().toLowerCase() === "s";
}

/**
 * Número "de votos": ponto é separador de milhar e vírgula é decimal
 * (ex.: "1.234.567" -> 1234567; "50,5" -> 50.5).
 */
export function toNumber(value: string | number | undefined | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Percentual (0–100): ponto ou vírgula como decimal (ex.: "50.00"/"50,00" -> 50).
 * Diferente de `toNumber`, que trata o ponto como separador de milhar.
 */
export function toPercent(value: string | number | undefined | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}