/**
 * Tipos normalizados (independentes do formato bruto do TSE) expostos pela API
 * do collector e consumidos pela web.
 */

export interface Medida {
  valor: number;
  /** Percentual já normalizado (0–100). */
  percentual: number;
}

export interface CandidateResult {
  numero: string;
  sqcand: string | null;
  nome: string;
  nomeUrna: string;
  partido: string;
  siglaPartido: string;
  federacao: string | null;
  coligacao: string | null;
  composicao: string | null;
  votos: number;
  /** Percentual informado pelo TSE (0–100). */
  percentual: number;
  /** Posição no ranking (1 = mais votado). */
  posicao: number;
  /** Marcado como eleito pela totalização oficial (campo `e` do TSE). */
  eleito: boolean;
  /**
   * Eleito por projeção matemática: mesmo que todos os votos válidos ainda não
   * apurados fossem para os adversários, este candidato continuaria entre os
   * mais votados (ver `computeEleicaoMatematica`). Calculado no coletor.
   */
  matematicamenteEleito: boolean;
  situacao: string | null;
  vice: string | null;
  suplentes: string[];
}

export interface SeccaoResumo {
  total: number;
  totalizadas: number;
  naoTotalizadas: number;
  instaladas: number;
  naoInstaladas: number;
  apuradas: number;
  naoApuradas: number;
  percentualTotalizadas: number;
  percentualApuradas: number;
}

export interface EleitoradoResumo {
  total: number;
  apurado: number;
  naoApurado: number;
  percentualApurado: number;
  comparecimento: number;
  percentualComparecimento: number;
  abstencoes: number;
  percentualAbstencoes: number;
}

export interface VotosResumo {
  validos: number;
  nominal: number;
  legenda: number;
  brancos: number;
  nulos: number;
  nulosTotal: number;
  anulados: number;
  votaveisConcorrentes: number;
}

export interface CargoResumo {
  codigo: number;
  nome: string;
}

export type AbrangenciaTipo = "br" | "uf" | "mu" | "zona";

export interface RaceResult {
  eleicao: number;
  cargo: number;
  uf: string;
  abrangencia: AbrangenciaTipo;
  geracao: string | null;
  atualizadoEm: string | null;
  andamento: string;
  totalizacaoFinal: boolean;
  divulgarVotacao: boolean;
  secoes: SeccaoResumo;
  eleitorado: EleitoradoResumo;
  votos: VotosResumo;
  candidatos: CandidateResult[];
}

/** Fotos usadas para histórico / evolução. */
export interface Snapshot {
  eleicao: number;
  cargo: number;
  uf: string;
  geracao: string | null;
  capturadoEm: string;
  percentualApurado: number;
  votosValidos: number;
  lider: { numero: string; nomeUrna: string; votos: number } | null;
}

/** Resumo de uma eleição/cargo para o painel inicial. */
export interface RaceSummary {
  eleicao: number;
  cargo: number;
  uf: string;
  atualizadoEm: string | null;
  totalizacaoFinal: boolean;
  percentualApurado: number;
  votosValidos: number;
  comparecimento: number;
  lider: {
    numero: string;
    nomeUrna: string;
    partido: string;
    votos: number;
    percentual: number;
  } | null;
}

export interface Municipio {
  /** Código TSE (5 dígitos). */
  cd: string;
  /** Código IBGE (7 dígitos), quando disponível. */
  cdi: string | null;
  nome: string;
  /** Zonas eleitorais do município. */
  zonas: string[];
  /** UF do município. */
  uf: string;
}

export interface UfMunicipios {
  uf: string;
  nome: string;
  municipios: Municipio[];
}
