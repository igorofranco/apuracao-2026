/**
 * Busca de município no mapa presidencial.
 *
 * O índice vem da própria malha municipal do Brasil (`municipios-brasil.json`),
 * que já é carregada para desenhar o mapa — nenhuma requisição extra. Os nomes
 * são comparados sem acentos e sem diferenciar maiúsculas/minúsculas.
 */

export interface MunicipioBusca {
  /** Código IBGE (7 dígitos). */
  id: string;
  /** Sigla da UF em minúsculas (ex.: `sp`). */
  uf: string;
  nome: string;
}

/** Normaliza para comparação: minúsculas, sem acentos e sem espaços nas pontas. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra e ordena municípios por nome. Quem **começa** com o termo vem antes de
 * quem apenas o contém; dentro de cada grupo a ordem é alfabética (pt-BR), com a
 * UF como desempate. Termos com menos de 2 caracteres não buscam.
 */
export function buscarMunicipios<T extends MunicipioBusca>(
  municipios: readonly T[],
  termo: string,
  limite = 8,
): T[] {
  const alvo = normalizarBusca(termo);
  if (alvo.length < 2 || limite <= 0) return [];

  const ordenar = (a: T, b: T) =>
    a.nome.localeCompare(b.nome, "pt-BR") ||
    a.uf.localeCompare(b.uf, "pt-BR") ||
    a.id.localeCompare(b.id);

  const comecam: T[] = [];
  const contem: T[] = [];
  for (const municipio of municipios) {
    const nome = normalizarBusca(municipio.nome);
    if (nome.startsWith(alvo)) comecam.push(municipio);
    else if (nome.includes(alvo)) contem.push(municipio);
  }

  return [...comecam.sort(ordenar), ...contem.sort(ordenar)].slice(0, limite);
}
