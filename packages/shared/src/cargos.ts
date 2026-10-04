/**
 * Cargos das Eleições Gerais de 2026 e metadados de abrangência.
 */

/** Abrangência territorial de um cargo. */
export type Abrangencia = "federal" | "estadual" | "distrital" | "municipal";

export interface Cargo {
  /** Código do cargo no TSE (usado no nome do arquivo `c000X`). */
  readonly codigo: number;
  readonly nome: string;
  /** Nome no plural/curto para UI. */
  readonly curto: string;
  readonly abrangencia: Abrangencia;
  /** A votação é apurada por UF (true) ou agregada no Brasil (false). */
  readonly porUf: boolean;
  /**
   * Ordem de exibição na navegação (menor = mais "principal").
   */
  readonly ordem: number;
}

export const CARGOS: readonly Cargo[] = [
  { codigo: 1, nome: "Presidente", curto: "Presidente", abrangencia: "federal", porUf: false, ordem: 0 },
  { codigo: 3, nome: "Governador", curto: "Governador", abrangencia: "estadual", porUf: true, ordem: 1 },
  { codigo: 5, nome: "Senador", curto: "Senador", abrangencia: "estadual", porUf: true, ordem: 2 },
  { codigo: 6, nome: "Deputado Federal", curto: "Dep. Federal", abrangencia: "estadual", porUf: true, ordem: 3 },
  { codigo: 7, nome: "Deputado Estadual", curto: "Dep. Estadual", abrangencia: "estadual", porUf: true, ordem: 4 },
  { codigo: 8, nome: "Deputado Distrital", curto: "Dep. Distrital", abrangencia: "distrital", porUf: true, ordem: 5 },
];

const CARGO_BY_CODIGO = new Map(CARGOS.map((c) => [c.codigo, c]));

export function getCargo(codigo: number | string): Cargo | undefined {
  return CARGO_BY_CODIGO.get(Number(codigo));
}

/** Cargos disponíveis em uma determinada UF (DF tem Dep. Distrital; demais não). */
export function cargosDaUf(uf: string): readonly Cargo[] {
  const sigla = uf.toLowerCase();
  const isDf = sigla === "df";
  return CARGOS.filter((c) => {
    if (c.abrangencia === "federal") return false;
    if (c.abrangencia === "distrital") return isDf;
    // Deputado Estadual (7) existe em todas as UFs, menos no DF.
    if (c.codigo === 7) return !isDf;
    return true;
  }).sort((a, b) => a.ordem - b.ordem);
}
