/**
 * Mock local do collector para os testes E2E (screenshots).
 *
 * Serve as mesmas rotas /api/* com dados determinísticos, para que as capturas
 * não dependam do TSE nem da rede. É iniciado pelo Playwright (webServer) e o
 * Next proxiа /api -> http://127.0.0.1:8787 (API_PROXY_TARGET).
 *
 * Sem dependências externas: roda com `node e2e/mock-server.mjs`.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const HOST = process.env.MOCK_HOST ?? "127.0.0.1";

/**
 * Cenário de 2º turno: o TSE publicou as eleições 6258 (Federal) e 6260
 * (Estadual), e o coletor mantém também o 1º turno para Senador/Deputados.
 */
const ELEICOES = {
  ciclo: "ele2026",
  federal: { cd: 6258, turno: 2, data: "2026-10-25T17:00:00-03:00", nome: "Federal" },
  estadual: { cd: 6260, turno: 2, data: "2026-10-25T17:00:00-03:00", nome: "Estadual" },
  primeiroTurno: {
    federal: { cd: 6257, turno: 1, data: "2026-10-04T17:00:00-03:00", nome: "Federal" },
    estadual: { cd: 6259, turno: 1, data: "2026-10-04T17:00:00-03:00", nome: "Estadual" },
  },
  doConfig: true,
};

const UFS = [
  { uf: "ac", nome: "Acre", regiao: "Norte", codigoIbge: 12 },
  { uf: "al", nome: "Alagoas", regiao: "Nordeste", codigoIbge: 27 },
  { uf: "ap", nome: "Amapá", regiao: "Norte", codigoIbge: 16 },
  { uf: "am", nome: "Amazonas", regiao: "Norte", codigoIbge: 13 },
  { uf: "ba", nome: "Bahia", regiao: "Nordeste", codigoIbge: 29 },
  { uf: "ce", nome: "Ceará", regiao: "Nordeste", codigoIbge: 23 },
  { uf: "df", nome: "Distrito Federal", regiao: "Centro-Oeste", codigoIbge: 53 },
  { uf: "es", nome: "Espírito Santo", regiao: "Sudeste", codigoIbge: 32 },
  { uf: "go", nome: "Goiás", regiao: "Centro-Oeste", codigoIbge: 52 },
  { uf: "ma", nome: "Maranhão", regiao: "Nordeste", codigoIbge: 21 },
  { uf: "mt", nome: "Mato Grosso", regiao: "Centro-Oeste", codigoIbge: 51 },
  { uf: "ms", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste", codigoIbge: 50 },
  { uf: "mg", nome: "Minas Gerais", regiao: "Sudeste", codigoIbge: 31 },
  { uf: "pa", nome: "Pará", regiao: "Norte", codigoIbge: 15 },
  { uf: "pb", nome: "Paraíba", regiao: "Nordeste", codigoIbge: 25 },
  { uf: "pr", nome: "Paraná", regiao: "Sul", codigoIbge: 41 },
  { uf: "pe", nome: "Pernambuco", regiao: "Nordeste", codigoIbge: 26 },
  { uf: "pi", nome: "Piauí", regiao: "Nordeste", codigoIbge: 22 },
  { uf: "rj", nome: "Rio de Janeiro", regiao: "Sudeste", codigoIbge: 33 },
  { uf: "rn", nome: "Rio Grande do Norte", regiao: "Nordeste", codigoIbge: 24 },
  { uf: "rs", nome: "Rio Grande do Sul", regiao: "Sul", codigoIbge: 43 },
  { uf: "ro", nome: "Rondônia", regiao: "Norte", codigoIbge: 11 },
  { uf: "rr", nome: "Roraima", regiao: "Norte", codigoIbge: 14 },
  { uf: "sc", nome: "Santa Catarina", regiao: "Sul", codigoIbge: 42 },
  { uf: "sp", nome: "São Paulo", regiao: "Sudeste", codigoIbge: 35 },
  { uf: "se", nome: "Sergipe", regiao: "Nordeste", codigoIbge: 28 },
  { uf: "to", nome: "Tocantins", regiao: "Norte", codigoIbge: 17 },
];

const CARGOS = [
  { codigo: 1, nome: "Presidente", curto: "Presidente", abrangencia: "federal", porUf: false, ordem: 0 },
  { codigo: 3, nome: "Governador", curto: "Governador", abrangencia: "estadual", porUf: true, ordem: 1 },
  { codigo: 5, nome: "Senador", curto: "Senador", abrangencia: "estadual", porUf: true, ordem: 2 },
  { codigo: 6, nome: "Deputado Federal", curto: "Dep. Federal", abrangencia: "estadual", porUf: true, ordem: 3 },
  { codigo: 7, nome: "Deputado Estadual", curto: "Dep. Estadual", abrangencia: "estadual", porUf: true, ordem: 4 },
  { codigo: 8, nome: "Deputado Distrital", curto: "Dep. Distrital", abrangencia: "distrital", porUf: true, ordem: 5 },
];

const PARTIDOS = [
  { sigla: "PL", nome: "PARTIDO LIBERAL" },
  { sigla: "PT", nome: "PARTIDO DOS TRABALHADORES" },
  { sigla: "UNIÃO", nome: "UNIÃO BRASIL" },
  { sigla: "PP", nome: "PROGRESSISTAS" },
  { sigla: "MDB", nome: "MOVIMENTO DEMOCRÁTICO BRASILEIRO" },
  { sigla: "REPUBLICANOS", nome: "REPUBLICANOS" },
  { sigla: "PSD", nome: "PARTIDO SOCIAL DEMOCRÁTICO" },
  { sigla: "PDT", nome: "PARTIDO DEMOCRÁTICO TRABALHISTA" },
  { sigla: "PSDB", nome: "PARTIDO DA SOCIAL DEMOCRACIA BRASILEIRA" },
  { sigla: "NOVO", nome: "PARTIDO NOVO" },
  { sigla: "PSOL", nome: "PARTIDO SOCIALISMO E LIBERDADE" },
  { sigla: "PODE", nome: "PODEMOS" },
  { sigla: "REDE", nome: "REDE SUSTENTABILIDADE" },
  { sigla: "SOLIDARIEDADE", nome: "SOLIDARIEDADE" },
  { sigla: "CIDADANIA", nome: "CIDADANIA" },
  { sigla: "PCdoB", nome: "PARTIDO COMUNISTA DO BRASIL" },
];

const NOMES = [
  { nome: "Ana Cristina Ribeiro", urna: "ANA RIBEIRO" },
  { nome: "Carlos Eduardo Mendes", urna: "CARLOS MENDES" },
  { nome: "Beatriz Almeida Lima", urna: "BEATRIZ LIMA" },
  { nome: "Eduardo Tavares Pinto", urna: "EDUARDO TAVARES" },
  { nome: "Fernanda Costa Rocha", urna: "FERNANDA COSTA" },
  { nome: "Gustavo Prado Nunes", urna: "GUSTAVO PRADO" },
  { nome: "Helena Duarte Sales", urna: "HELENA DUARTE" },
  { nome: "Igor Salles Martins", urna: "IGOR SALLES" },
  { nome: "Juliana Moraes Reis", urna: "JULIANA MORAES" },
  { nome: "Kleber Nunes Fontes", urna: "KLEBER NUNES" },
  { nome: "Larissa Campos Faria", urna: "LARISSA CAMPOS" },
  { nome: "Marcelo Vieira Braga", urna: "MARCELO VIEIRA" },
  { nome: "Natália Freitas Gomes", urna: "NATÁLIA FREITAS" },
  { nome: "Otávio Ramos Correia", urna: "OTÁVIO RAMOS" },
  { nome: "Patrícia Lemos Barros", urna: "PATRÍCIA LEMOS" },
  { nome: "Rodrigo Antunes Peixoto", urna: "RODRIGO ANTUNES" },
  { nome: "Sofia Camargo Dias", urna: "SOFIA CAMARGO" },
  { nome: "Tiago Bezerra Cunha", urna: "TIAGO BEZERRA" },
  { nome: "Vanessa Pires Amaral", urna: "VANESSA PIRES" },
  { nome: "Wagner Oliveira Luz", urna: "WAGNER OLIVEIRA" },
];

/**
 * Candidatos do 2º turno presidencial, conforme o arquivo oficial 6258
 * (votação simulada). As fotos vêm do pacote público do TSE, por `sqcand`.
 */
const RUNOFF_PRESIDENTE = [
  {
    numero: "22",
    nome: "Flavio Nantes Bolsonaro",
    urna: "FLAVIO BOLSONARO",
    partido: "PARTIDO LIBERAL",
    sigla: "PL",
    coligacao: null,
    vice: "ALFREDO GASPAR",
    sqcand: "280002551544",
    votos: 0,
  },
  {
    numero: "13",
    nome: "Luiz Inácio Lula da Silva",
    urna: "LULA",
    partido: "PARTIDO DOS TRABALHADORES",
    sigla: "PT",
    coligacao: "BRASIL PRONTO PRA MAIS",
    vice: "GERALDO ALCKMIN",
    sqcand: "280002542548",
    votos: 0,
  },
];

/** Eleições em que só Presidente/Governador disputam (2 candidatos). */
function ehRunoff(eleicao, cargo) {
  return (eleicao === 6258 && cargo === 1) || (eleicao === 6260 && cargo === 3);
}

/**
 * Pré-visualização do mapa por estado antes da votação oficial: com
 * `MOCK_RUNOFF_VOTOS=1` o mock devolve uma apuração simulada por UF (aproximada
 * do 2º turno de 2022). Desligado por padrão, para os testes refletirem o
 * cenário real de 2026 — arquivo 6258 publicado com 0 voto.
 */
const SIMULAR_VOTOS = process.env.MOCK_RUNOFF_VOTOS === "1";

/** [% de Lula no 2º turno de 2022, eleitorado aproximado em milhões]. */
const CENARIO_PRESIDENTE = {
  ac: [32, 0.57],
  al: [67, 2.3],
  ap: [51, 0.55],
  am: [61, 2.6],
  ba: [72, 11.0],
  ce: [72, 6.9],
  df: [41, 2.2],
  es: [51, 2.9],
  go: [42, 4.9],
  ma: [71, 5.0],
  mt: [36, 2.6],
  ms: [39, 2.0],
  mg: [51, 16.0],
  pa: [54, 6.0],
  pb: [68, 3.0],
  pr: [36, 8.0],
  pe: [66, 7.0],
  pi: [71, 2.5],
  rj: [45, 12.8],
  rn: [66, 2.5],
  rs: [39, 8.5],
  ro: [36, 1.2],
  rr: [42, 0.4],
  sc: [30, 5.3],
  sp: [45, 34.0],
  se: [66, 1.7],
  to: [51, 1.1],
};

/** Cache das malhas municipais usadas pelo drill-down do mapa. */
const GEO_MUNICIPIOS = new Map();

function municipiosGeo(uf) {
  if (GEO_MUNICIPIOS.has(uf)) return GEO_MUNICIPIOS.get(uf);
  let json = null;
  try {
    json = JSON.parse(
      readFileSync(
        new URL(`../public/geo/municipios/${uf}.json`, import.meta.url),
        "utf8",
      ),
    );
  } catch {
    json = null;
  }
  GEO_MUNICIPIOS.set(uf, json);
  return json;
}

/**
 * Votação simulada de um município: parte do percentual estadual e aplica uma
 * variação determinística por município, para o mapa ganhar textura.
 */
function votosMunicipioPresidente(uf, cdi) {
  if (!SIMULAR_VOTOS) {
    return { votos: { "13": 0, "22": 0 }, votosValidos: 0 };
  }
  const base = CENARIO_PRESIDENTE[uf]?.[0] ?? 50;
  const variacao = ((hash(`mun:${cdi}`) % 1601) / 100) - 8; // -8 a +8 pontos
  const share = Math.max(5, Math.min(95, base + variacao));
  const validos = 500 + (hash(`eleitores:${cdi}`) % 50_000);
  const lula = Math.round((validos * share) / 100);
  return {
    votos: { "13": lula, "22": validos - lula },
    votosValidos: validos,
  };
}

/** Votos simulados por candidato (13 = Lula, 22 = Flávio) em uma UF. */
function votosSimuladosPresidente(uf) {
  if (uf === "br") {
    const total = { "13": 0, "22": 0 };
    for (const u of UFS) {
      const votos = votosSimuladosPresidente(u.uf);
      total["13"] += votos["13"];
      total["22"] += votos["22"];
    }
    return total;
  }
  const cenario = CENARIO_PRESIDENTE[uf];
  if (!cenario) return { "13": 0, "22": 0 };
  const [shareLula, eleitorado] = cenario;
  // Aproximação de votos válidos (comparecimento menos brancos/nulos).
  const validos = Math.round(eleitorado * 1_000_000 * 0.8);
  const lula = Math.round((validos * shareLula) / 100);
  return { "13": lula, "22": validos - lula };
}

const round2 = (n) => Math.round(n * 100) / 100;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MAJORITARIOS = new Set([1, 3, 5]);

/**
 * Dois candidatos do 2º turno. Presidente usa nomes fixos; Governador é gerado
 * de forma determinística a partir da UF.
 */
function makeRunoffCandidatos(cargo, chave) {
  const finalizar = ({ candidatos, soma }) => {
    for (const c of candidatos) {
      c.percentual = soma > 0 ? round2((c.votos / soma) * 100) : 0;
    }
    // Sem votos ainda, mantemos um eleitorado plausível para a tela de espera.
    const eleitoradoBase = cargo === 1 ? 123_000_000 : 11_252_936;
    return { candidatos, soma, totalVotos: soma > 0 ? soma : eleitoradoBase };
  };

  if (cargo === 1) {
    const simulados = SIMULAR_VOTOS ? votosSimuladosPresidente(chave) : null;
    const candidatos = RUNOFF_PRESIDENTE.map((c, i) => ({
      numero: c.numero,
      sqcand: c.sqcand,
      nome: c.nome,
      nomeUrna: c.urna,
      partido: c.partido,
      siglaPartido: c.sigla,
      federacao: null,
      coligacao: c.coligacao,
      composicao: null,
      votos: simulados ? (simulados[c.numero] ?? 0) : 0,
      percentual: 0,
      posicao: i + 1,
      eleito: false,
      matematicamenteEleito: false,
      matematicamenteSegundoTurno: false,
      segundoTurnoOficial: true,
      situacao: "2º turno",
      vice: c.vice,
      suplentes: [],
    }));
    // Com votos simulados, replica a ordenação do domínio (mais votado primeiro;
    // empate cai no nome de urna). Sem votos, mantém a ordem do arquivo.
    if (simulados) {
      candidatos.sort(
        (a, b) =>
          b.votos - a.votos || a.nomeUrna.localeCompare(b.nomeUrna, "pt-BR"),
      );
      candidatos.forEach((c, i) => {
        c.posicao = i + 1;
      });
    }
    const soma = candidatos.reduce((a, c) => a + c.votos, 0);
    return finalizar({ candidatos, soma });
  }

  const off = hash(chave) % NOMES.length;
  const definicoes = [
    { votos: 0, i: 0 },
    { votos: 0, i: 3 },
  ];
  const candidatos = definicoes.map((d, i) => {
    const partido = PARTIDOS[(off + d.i) % PARTIDOS.length];
    const pessoa = NOMES[(off + d.i) % NOMES.length];
    return {
      numero: String(10 + ((off + d.i) % 8) * 3),
      sqcand: null,
      nome: pessoa.nome,
      nomeUrna: pessoa.urna,
      partido: partido.nome,
      siglaPartido: partido.sigla,
      federacao: null,
      coligacao: `COLIGAÇÃO ${partido.sigla.toUpperCase()}`,
      composicao: null,
      votos: d.votos,
      percentual: 0,
      posicao: i + 1,
      eleito: false,
      matematicamenteEleito: false,
      matematicamenteSegundoTurno: false,
      segundoTurnoOficial: true,
      situacao: "2º turno",
      vice: NOMES[(off + d.i + 7) % NOMES.length].urna,
      suplentes: [],
    };
  });
  const soma = candidatos.reduce((a, c) => a + c.votos, 0);
  return finalizar({ candidatos, soma });
}

function makeCandidatos(cargo, chave, eleicao) {
  if (ehRunoff(eleicao, cargo)) return makeRunoffCandidatos(cargo, chave);
  const major = MAJORITARIOS.has(cargo);
  const total = major ? 6 : 16;
  const base =
    cargo === 1 ? 41_000_000
    : cargo === 3 ? 5_200_000
    : cargo === 5 ? 3_100_000
    : cargo === 6 ? 780_000
    : cargo === 7 ? 260_000
    : 90_000;
  const decay = major ? 0.62 : 0.86;
  // Cenário "eleição matemática": nos majoritários o líder abre uma vantagem
  // grande (decay do 2º colocado), o que o torna matematicamente eleito já com
  // parte das seções apuradas — usado para validar o badge na UI/E2E.
  const decaimentoLider = cargo === 1 ? 0.35 : 0.45;
  const off = hash(chave) % NOMES.length;

  let votos = base * (0.7 + (hash(`${chave}:${cargo}`) % 40) / 100);
  const candidatos = [];
  for (let i = 0; i < total; i++) {
    const partido = PARTIDOS[(off + i) % PARTIDOS.length];
    const pessoa = NOMES[(off + i) % NOMES.length];
    // Majoritário: a apuração ainda está em curso (ninguém "eleito" oficialmente
    // no mock) — quem estiver garantido aparece como "matematicamente eleito".
    // Proporcional: os 4 primeiros ficam marcados.
    const eleito = major ? false : i < 4;
    candidatos.push({
      numero: String((cargo === 1 ? 10 : 10) + i * 3),
      sqcand: null,
      nome: pessoa.nome,
      nomeUrna: pessoa.urna,
      partido: partido.nome,
      siglaPartido: partido.sigla,
      federacao: null,
      coligacao: i < 3 ? `COLIGAÇÃO ${partido.sigla.toUpperCase()}` : null,
      composicao: null,
      votos: Math.round(votos),
      percentual: 0,
      posicao: i + 1,
      eleito,
      matematicamenteEleito: false,
      matematicamenteSegundoTurno: false,
      segundoTurnoOficial: false,
      situacao: eleito ? "Eleito" : i < (major ? 2 : 8) ? "Não eleito" : "Suplente",
      vice: major ? NOMES[(off + total + i) % NOMES.length].urna : null,
      suplentes: cargo === 5 ? [NOMES[(off + i * 2) % NOMES.length].urna] : [],
    });
    votos *= i === 0 && major ? decaimentoLider : decay;
  }

  const soma = candidatos.reduce((a, c) => a + c.votos, 0);
  const totalVotos = Math.round(soma * 1.28);
  for (const c of candidatos) {
    c.percentual = round2((c.votos / totalVotos) * 100);
  }
  return { candidatos, soma, totalVotos };
}

function makeRace({ eleicao, cargo, uf, municipio, zona }) {
  const chave = [uf, municipio, zona].filter(Boolean).join("-") || uf;
  const { candidatos, soma, totalVotos } = makeCandidatos(cargo, chave, eleicao);
  const abrangencia = zona ? "zona" : municipio ? "mu" : uf === "br" ? "br" : "uf";
  const runoff = ehRunoff(eleicao, cargo);

  // Majoritário: quase totalizado, para o cenário de "eleição matemática" já
  // aparecer (líder inalcançável). Demais: percentual variado. No 2º turno a
  // apuração está em curso (cenário simulado).
  const major = MAJORITARIOS.has(cargo);
  // 2º turno sem votos (o arquivo do TSE já tem os candidatos, mas 0 apurado).
  const semVotos = soma === 0;
  const pct = semVotos
    ? 0
    : runoff
      ? round2(88 + (hash(`${chave}:${cargo}:runoff`) % 80) / 10)
      : major
        ? 99.2
        : round2(55 + (hash(`${chave}:${cargo}`) % 450) / 10);

  const secoesTotal =
    runoff && cargo === 1 ? 499_248 : 60_000 + (hash(chave) % 90_000);
  const secoesTotalizadas = Math.round((secoesTotal * pct) / 100);
  const eleitoradoTotal = Math.round(totalVotos / 0.78);
  const brancos = Math.round(soma * 0.03);
  const nulos = Math.round(soma * 0.04);

  return {
    eleicao,
    cargo,
    uf,
    abrangencia,
    geracao: runoff ? "20261015093812" : "20261004184200",
    atualizadoEm: runoff ? "2026-10-15T09:38:12-03:00" : "2026-10-04T18:42:11-03:00",
    andamento: semVotos ? "n" : "s",
    totalizacaoFinal: false,
    divulgarVotacao: true,
    secoes: {
      total: secoesTotal,
      totalizadas: secoesTotalizadas,
      naoTotalizadas: secoesTotal - secoesTotalizadas,
      instaladas: semVotos ? 0 : secoesTotal,
      naoInstaladas: semVotos ? secoesTotal : 0,
      apuradas: secoesTotalizadas,
      naoApuradas: secoesTotal - secoesTotalizadas,
      percentualTotalizadas: pct,
      percentualApuradas: pct,
    },
    eleitorado: {
      total: eleitoradoTotal,
      apurado: semVotos ? 0 : totalVotos,
      naoApurado: semVotos ? eleitoradoTotal : eleitoradoTotal - totalVotos,
      percentualApurado: semVotos ? 0 : round2((totalVotos / eleitoradoTotal) * 100),
      comparecimento: semVotos ? 0 : totalVotos,
      percentualComparecimento: semVotos
        ? 0
        : round2((totalVotos / eleitoradoTotal) * 100),
      abstencoes: semVotos ? 0 : eleitoradoTotal - totalVotos,
      percentualAbstencoes: semVotos
        ? 0
        : round2(((eleitoradoTotal - totalVotos) / eleitoradoTotal) * 100),
    },
    votos: {
      validos: soma,
      nominal: soma,
      legenda: 0,
      brancos,
      nulos,
      nulosTotal: nulos,
      anulados: 0,
      votaveisConcorrentes: soma,
    },
    candidatos,
  };
}

function makeSummary(eleicao, cargo, uf) {
  const race = makeRace({ eleicao, cargo, uf });
  const lider = race.candidatos[0] ?? null;
  return {
    eleicao,
    cargo,
    uf,
    atualizadoEm: race.atualizadoEm,
    totalizacaoFinal: false,
    percentualApurado: race.secoes.percentualTotalizadas,
    votosValidos: race.votos.validos,
    comparecimento: race.eleitorado.comparecimento,
    lider:
      lider && lider.votos > 0
        ? {
            numero: lider.numero,
            nomeUrna: lider.nomeUrna,
            partido: lider.siglaPartido,
            votos: lider.votos,
            percentual: lider.percentual,
          }
        : null,
    // Votação dos principais candidatos (mapa presidencial por estado).
    candidatos: race.candidatos.slice(0, 5).map((c) => ({
      numero: c.numero,
      nomeUrna: c.nomeUrna,
      siglaPartido: c.siglaPartido,
      votos: c.votos,
      percentual: c.percentual,
    })),
  };
}

const MUNICIPIOS_SP = [
  { cd: "71072", cdi: "3550308", nome: "São Paulo", zonas: ["1", "2", "258", "360"], uf: "sp" },
  { cd: "60001", cdi: "3509502", nome: "Campinas", zonas: ["5", "6"], uf: "sp" },
  { cd: "60002", cdi: "3518800", nome: "Guarulhos", zonas: ["7"], uf: "sp" },
  { cd: "60003", cdi: "3526902", nome: "Limeira", zonas: ["8"], uf: "sp" },
  { cd: "60004", cdi: "3538709", nome: "Piracicaba", zonas: ["9"], uf: "sp" },
  { cd: "60005", cdi: "3548708", nome: "São Bernardo do Campo", zonas: ["10"], uf: "sp" },
  { cd: "60006", cdi: "3552205", nome: "Sorocaba", zonas: ["11"], uf: "sp" },
  { cd: "60007", cdi: "3547809", nome: "Santo André", zonas: ["12"], uf: "sp" },
];

const MUNICIPIOS_DF = [
  { cd: "97001", cdi: "5300108", nome: "Brasília", zonas: ["1", "2", "3"], uf: "df" },
  { cd: "97002", cdi: null, nome: "Ceilândia", zonas: ["4"], uf: "df" },
  { cd: "97003", cdi: null, nome: "Taguatinga", zonas: ["5"], uf: "df" },
  { cd: "97004", cdi: null, nome: "Planaltina", zonas: ["6"], uf: "df" },
  { cd: "97005", cdi: null, nome: "Gama", zonas: ["7"], uf: "df" },
  { cd: "97006", cdi: null, nome: "Sobradinho", zonas: ["8"], uf: "df" },
  { cd: "97007", cdi: null, nome: "Samambaia", zonas: ["9"], uf: "df" },
  { cd: "97008", cdi: null, nome: "Guará", zonas: ["10"], uf: "df" },
];

function municipiosDe(uf) {
  if (uf === "sp") return MUNICIPIOS_SP;
  if (uf === "df") return MUNICIPIOS_DF;
  const base = hash(uf);
  return Array.from({ length: 8 }, (_, i) => ({
    cd: String((base % 80_000) + 1_000 + i).padStart(5, "0"),
    cdi: null,
    nome: `Município ${String(i + 1).padStart(2, "0")}`,
    zonas: [String(i + 1)],
    uf,
  }));
}

/**
 * Série de histórico: 10 gerações, sendo a 1ª sem votos e as 2 últimas
 * repetindo o resultado final. O gráfico deve recortar as pontas e mostrar só
 * o trecho em que os percentuais mudam.
 *
 * Os percentuais dos candidatos são simulados convergindo para o resultado
 * final — o líder começa um pouco acima e vai perdendo vantagem.
 */
function makeHistorico(eleicao, cargo, uf) {
  const race = makeRace({ eleicao, cargo, uf });
  const pctFinal = race.secoes.percentualTotalizadas;
  const votosFinal = race.votos.validos;
  const runoff = ehRunoff(eleicao, cargo);
  const horaBase = runoff ? 19 : 18;
  const dataBase = runoff ? "2026-10-25" : "2026-10-04";
  const dataCompacta = dataBase.replace(/-/g, "");
  // Sem votos, o histórico tem só a geração inicial (como no coletor real).
  // Com votos, 7 pontos evoluindo + 2 repetições finais para exercitar o recorte.
  const totalPassos = votosFinal > 0 ? 10 : 1;
  const ultimoComDados = 7;
  const candidatosFinal = race.candidatos.slice(0, 8);
  // 2º turno ainda sem votos: a série inteira fica zerada e o gráfico mostra o
  // estado vazio, sem reaproveitar percentuais de simulação.
  const semVotos = votosFinal === 0;

  const snapshot = (i) => {
    const minutos = i * 4;
    const hh = String(horaBase + Math.floor(minutos / 60)).padStart(2, "0");
    const mm = String(minutos % 60).padStart(2, "0");
    const fator = i <= ultimoComDados ? i / ultimoComDados : 1;
    const semDados = i === 0;
    const validos = semDados ? 0 : Math.round(votosFinal * fator);
    const apurado = semDados ? 0 : round2(pctFinal * fator);

    const candidatos = candidatosFinal.map((c, j) => {
      // Diferença inicial: o líder começa acima e os demais dividem a sobra.
      const delta = j === 0 ? 4 : -4 / Math.max(1, candidatosFinal.length - 1);
      const percentual =
        semDados || semVotos
          ? 0
          : round2(Math.max(0, c.percentual + (1 - fator) * delta));
      return {
        numero: c.numero,
        nomeUrna: c.nomeUrna,
        siglaPartido: c.siglaPartido,
        votos: semDados || semVotos ? 0 : Math.round((validos * percentual) / 100),
        percentual,
      };
    });

    const lider = candidatos.reduce(
      (a, c) => (c.votos > a.votos ? c : a),
      candidatos[0],
    );

    return {
      eleicao,
      cargo,
      uf,
      geracao: `${dataCompacta}${hh}${mm}00`,
      capturadoEm: `${dataBase}T${hh}:${mm}:00-03:00`,
      percentualApurado: apurado,
      votosValidos: validos,
      lider:
        lider && lider.votos > 0
          ? { numero: lider.numero, nomeUrna: lider.nomeUrna, votos: lider.votos }
          : null,
      candidatos,
    };
  };

  return {
    eleicao,
    cargo,
    uf,
    snapshots: Array.from({ length: totalPassos }, (_, i) => snapshot(i)),
  };
}

function buildResumo() {
  const corridas = [makeSummary(6258, 1, "br")];
  for (const u of UFS) {
    // Presidente também por UF (mapa do 2º turno).
    corridas.push(makeSummary(6258, 1, u.uf));
    // Governador: 2º turno + 1º turno (fallback de estados sem disputa).
    // Senador segue com os dados do 1º turno.
    corridas.push(makeSummary(6260, 3, u.uf));
    corridas.push(makeSummary(6259, 3, u.uf));
    corridas.push(makeSummary(6259, 5, u.uf));
  }
  return { eleicao: ELEICOES, total: corridas.length, corridas };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

const RESULTADO_MEMO = new Map();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const q = url.searchParams;

  if (path === "/health") return json(res, 200, { ok: true });

  if (path === "/api/config") {
    return json(res, 200, { eleicao: ELEICOES, ufs: UFS, cargos: CARGOS });
  }

  if (path === "/api/status") {
    return json(res, 200, { ok: true, mode: "mock", serverTime: new Date().toISOString() });
  }

  if (path === "/api/resumo") return json(res, 200, buildResumo());

  if (path === "/api/resultado") {
    const eleicao = Number(q.get("eleicao") ?? 6257);
    const cargo = Number(q.get("cargo") ?? 1);
    const uf = (q.get("uf") ?? "").toLowerCase() || (cargo === 1 ? "br" : "sp");
    const municipio = q.get("municipio") ?? undefined;
    const zona = q.get("zona") ?? undefined;
    const chave = `${eleicao}:${cargo}:${uf}:${municipio ?? ""}:${zona ?? ""}`;
    if (!RESULTADO_MEMO.has(chave)) {
      RESULTADO_MEMO.set(chave, makeRace({ eleicao, cargo, uf, municipio, zona }));
    }
    return json(res, 200, RESULTADO_MEMO.get(chave));
  }

  if (path === "/api/historico") {
    const eleicao = Number(q.get("eleicao") ?? 6257);
    const cargo = Number(q.get("cargo") ?? 1);
    const uf = (q.get("uf") ?? "br").toLowerCase();
    return json(res, 200, makeHistorico(eleicao, cargo, uf));
  }

  if (path === "/api/municipios") {
    const eleicao = Number(q.get("eleicao") ?? 6259);
    const uf = (q.get("uf") ?? "sp").toLowerCase();
    const municipios = municipiosDe(uf);
    return json(res, 200, { eleicao, uf, total: municipios.length, municipios });
  }

  if (path === "/api/presidente/municipios") {
    const eleicao = Number(q.get("eleicao") ?? 6258);
    const uf = (q.get("uf") ?? "").toLowerCase();
    const geo = uf ? municipiosGeo(uf) : null;
    if (!geo) {
      return json(res, 404, { error: "malha municipal indisponível", uf });
    }
    const atualizadoEm = SIMULAR_VOTOS
      ? "2026-10-25T19:42:00-03:00"
      : "2026-10-15T09:38:00-03:00";
    const municipios = geo.features.map((f) => ({
      cd: String(f.properties.id),
      cdi: String(f.properties.id),
      nome: String(f.properties.name ?? "").toUpperCase(),
      uf,
      ...votosMunicipioPresidente(uf, f.properties.id),
      semDados: false,
      atualizadoEm,
    }));
    return json(res, 200, {
      eleicao,
      cargo: 1,
      uf,
      total: municipios.length,
      coletados: municipios.length,
      preparando: false,
      atualizadoEm,
      municipios,
    });
  }

  if (path === "/api/live") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write("retry: 5000\n");
    res.write(
      `event: hello\ndata: ${JSON.stringify({ corridas: 28, at: "2026-10-04T18:42:11-03:00" })}\n\n`,
    );
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.on("close", () => clearInterval(heartbeat));
    return;
  }

  json(res, 404, { error: "rota não encontrada", path });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock] API de teste em http://${HOST}:${PORT}`);
});

const encerrar = () => server.close(() => process.exit(0));
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
