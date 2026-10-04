/**
 * Cores dos partidos para o mapa.
 *
 * O objetivo é duplo: (1) lembrar as cores reais das legendas e (2) dar uma
 * leitura ideológica à distância — partidos de esquerda em tons quentes
 * (vermelho/laranja) e de direita em tons frios (azul/violeta), com o centro
 * em verdes/teais. Assim o mapa deixa de ser uma cor aleatória por hash.
 *
 * As siglas são normalizadas (`UNIÃO` = `UNIAO` = `PC do B` = `PCDOB`) para
 * casar com o que o TSE devolve em cada arquivo.
 */

export type Espectro =
  | "esquerda"
  | "centro-esquerda"
  | "centro"
  | "centro-direita"
  | "direita";

export interface Partido {
  /** Sigla canônica: sem acento, sem espaços/pontos, em maiúsculas. */
  sigla: string;
  /** Nome de exibição (usado em `title`/acessibilidade). */
  nome: string;
  /** Cor (hex) usada no mapa e na legenda. */
  cor: string;
  /** Posição aproximada no espectro político. */
  espectro: Espectro;
}

/**
 * Paleta por partido. A ordem lista da esquerda (quente) para a direita (frio).
 * Quando a legenda tem cor oficial marcante (PT vermelho, PSDB azul), ela é
 * preservada; nos demais o tom é escolhido para reforçar o espectro.
 */
export const PARTIDOS: Partido[] = [
  // ── Esquerda · tons quentes (vermelho/carmim) ──────────────────────────
  { sigla: "PT", nome: "Partido dos Trabalhadores", cor: "#D81E2C", espectro: "esquerda" },
  { sigla: "PCdoB", nome: "Partido Comunista do Brasil", cor: "#9B1C31", espectro: "esquerda" },
  { sigla: "PCB", nome: "Partido Comunista Brasileiro", cor: "#D62828", espectro: "esquerda" },
  { sigla: "PSOL", nome: "Partido Socialismo e Liberdade", cor: "#C2185B", espectro: "esquerda" },
  { sigla: "PSTU", nome: "Partido Socialista dos Trabalhadores Unificado", cor: "#B31212", espectro: "esquerda" },
  { sigla: "PCO", nome: "Partido da Causa Operária", cor: "#7A0C0C", espectro: "esquerda" },
  { sigla: "UP", nome: "Unidade Popular", cor: "#A81E5A", espectro: "esquerda" },

  // ── Centro-esquerda · quentes (laranja/âmbar) e verdes ─────────────────
  { sigla: "PDT", nome: "Partido Democrático Trabalhista", cor: "#E8590C", espectro: "centro-esquerda" },
  { sigla: "PSB", nome: "Partido Socialista Brasileiro", cor: "#F08C00", espectro: "centro-esquerda" },
  { sigla: "PV", nome: "Partido Verde", cor: "#2F9E44", espectro: "centro-esquerda" },
  { sigla: "REDE", nome: "Rede Sustentabilidade", cor: "#14845B", espectro: "centro-esquerda" },

  // ── Centro · verdes/teais/neutros ──────────────────────────────────────
  { sigla: "MDB", nome: "Movimento Democrático Brasileiro", cor: "#157F5A", espectro: "centro" },
  { sigla: "CIDADANIA", nome: "Cidadania", cor: "#E4572E", espectro: "centro" },
  { sigla: "SOLIDARIEDADE", nome: "Solidariedade", cor: "#D97706", espectro: "centro" },
  { sigla: "AVANTE", nome: "Avante", cor: "#0E7490", espectro: "centro" },
  { sigla: "MOBILIZA", nome: "Mobilização Nacional", cor: "#0F766E", espectro: "centro" },
  { sigla: "AGIR", nome: "Agir", cor: "#64748B", espectro: "centro" },
  { sigla: "DEMOCRATA", nome: "Democrata", cor: "#334155", espectro: "centro" },

  // ── Centro-direita · tons frios (azul/ciano) ───────────────────────────
  { sigla: "PSDB", nome: "Partido da Social Democracia Brasileira", cor: "#1565C0", espectro: "centro-direita" },
  { sigla: "PSD", nome: "Partido Social Democrático", cor: "#0277BD", espectro: "centro-direita" },
  { sigla: "PP", nome: "Progressistas", cor: "#1E88E5", espectro: "centro-direita" },
  { sigla: "PODE", nome: "Podemos", cor: "#06A3C4", espectro: "centro-direita" },

  // ── Direita · tons frios (azul-escuro/índigo/violeta) ──────────────────
  { sigla: "PL", nome: "Partido Liberal", cor: "#0B3D91", espectro: "direita" },
  { sigla: "REPUBLICANOS", nome: "Republicanos", cor: "#0D47A1", espectro: "direita" },
  { sigla: "UNIÃO", nome: "União Brasil", cor: "#3949AB", espectro: "direita" },
  { sigla: "PRD", nome: "Partido Renovação Democrática", cor: "#2563EB", espectro: "direita" },
  { sigla: "NOVO", nome: "Partido Novo", cor: "#6D28D9", espectro: "direita" },
  { sigla: "MISSÃO", nome: "Partido Missão", cor: "#7E22CE", espectro: "direita" },
  { sigla: "PRTB", nome: "Partido Renovador Trabalhista Brasileiro", cor: "#4338CA", espectro: "direita" },
  { sigla: "DC", nome: "Democracia Cristã", cor: "#1E293B", espectro: "direita" },
];

const POR_SIGLA = new Map(PARTIDOS.map((p) => [siglaCanonica(p.sigla), p]));

/** Normaliza a sigla como o TSE entrega: "UNIÃO", "PC do B", "PSDB". */
export function siglaCanonica(sigla: string): string {
  return sigla
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/** Partido conhecido pela sigla (ou `undefined` se não catalogado). */
export function getPartido(sigla: string): Partido | undefined {
  return POR_SIGLA.get(siglaCanonica(sigla));
}

/** Nome legível do partido (ou a própria sigla quando desconhecido). */
export function nomePartido(sigla: string): string {
  return getPartido(sigla)?.nome ?? sigla;
}

/** Cor estável para siglas fora da paleta (não devem ocorrer no TSE atual). */
function corDesconhecida(sigla: string): string {
  let h = 0;
  for (let i = 0; i < sigla.length; i++) h = (h * 31 + sigla.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 48%)`;
}

/** Cor do partido no mapa/legenda. */
export function corPartido(sigla: string): string {
  return getPartido(sigla)?.cor ?? corDesconhecida(sigla);
}
