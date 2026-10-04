/**
 * Chave canônica de uma corrida (eleição/cargo/UF), usada para indexar o store,
 * caches e índices de histórico. Mantida em um único lugar para não divergir.
 */
export interface RaceKeyParts {
  eleicao: number;
  cargo: number;
  uf: string;
}

export function raceKey(parts: RaceKeyParts): string {
  return `${parts.eleicao}:${parts.cargo}:${parts.uf}`;
}
