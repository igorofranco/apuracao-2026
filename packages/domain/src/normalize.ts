import type {
  CandidateResult,
  EleitoradoResumo,
  Municipio,
  RaceResult,
  RaceSummary,
  SeccaoResumo,
  Snapshot,
  UfMunicipios,
  VotosResumo,
  AbrangenciaTipo,
} from "./types.ts";
import type { RawResultado, RawMunicipioFile } from "./raw.ts";
import { toBool, toNumber } from "./numbers.ts";
import { ehSegundoTurnoOficial } from "./matematica.ts";

/** "04/10/2026" + "17:30:00" -> ISO (America/Sao_Paulo). */
export function parseDataHora(
  data: string | undefined,
  hora: string | undefined,
): string | null {
  if (!data || !/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return null;
  const [dia, mes, ano] = data.split("/") as [string, string, string];
  const hhmmss = /^\d{2}:\d{2}(:\d{2})?$/.test(hora ?? "") ? (hora as string) : "00:00:00";
  const hms = hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss;
  // Offset fixo de Brasília (sem horário de verão desde 2019).
  return `${ano}-${mes}-${dia}T${hms}-03:00`;
}

function abrangenciaFrom(raw: RawResultado): AbrangenciaTipo {
  switch ((raw.tpabr ?? "").toLowerCase()) {
    case "br":
      return "br";
    case "uf":
      return "uf";
    case "mu":
      return "mu";
    case "zona":
    case "zn":
      return "zona";
    default:
      return "br";
  }
}

function normalizeSecoes(raw: RawResultado): SeccaoResumo {
  const s = raw.s ?? {};
  return {
    total: toNumber(s.ts),
    totalizadas: toNumber(s.st),
    naoTotalizadas: toNumber(s.snt),
    instaladas: toNumber(s.si),
    naoInstaladas: toNumber(s.sni),
    apuradas: toNumber(s.sa),
    naoApuradas: toNumber(s.sna),
    percentualTotalizadas: toNumber(s.pst),
    percentualApuradas: toNumber(s.psa),
  };
}

function normalizeEleitorado(raw: RawResultado): EleitoradoResumo {
  const e = raw.e ?? {};
  return {
    total: toNumber(e.te),
    apurado: toNumber(e.esa),
    naoApurado: toNumber(e.esna),
    percentualApurado: toNumber(e.pesa),
    comparecimento: toNumber(e.c),
    percentualComparecimento: toNumber(e.pc),
    abstencoes: toNumber(e.a),
    percentualAbstencoes: toNumber(e.pa),
  };
}

function normalizeVotos(raw: RawResultado): VotosResumo {
  const v = raw.v ?? {};
  return {
    validos: toNumber(v.vv ?? v.vvc),
    nominal: toNumber(v.vnom),
    legenda: toNumber(v.vl),
    brancos: toNumber(v.vb),
    nulos: toNumber(v.vn),
    nulosTotal: toNumber(v.tvn),
    anulados: toNumber(v.van),
    votaveisConcorrentes: toNumber(v.vvc),
  };
}

function normalizeCandidatos(raw: RawResultado): CandidateResult[] {
  const carg = raw.carg[0];
  if (!carg) return [];
  const federacoes = new Map(
    (carg.fed ?? []).map((f) => [f.n, f.sg ?? f.nm ?? f.com ?? ""]),
  );

  const candidatos: CandidateResult[] = [];
  for (const agr of carg.agr) {
    const isColigacao = (agr.tp ?? "").toLowerCase() === "c";
    const isFederacao = (agr.tp ?? "").toLowerCase() === "f";
    for (const partido of agr.par) {
      for (const cand of partido.cand) {
        const vs = cand.vs ?? [];
        const vice = vs.find((x) => (x.tp ?? "").toLowerCase() === "v");
        const suplentes = vs
          .filter((x) => (x.tp ?? "").toLowerCase() === "s")
          .map((x) => x.nmu ?? x.nm ?? "")
          .filter(Boolean);
        candidatos.push({
          numero: cand.n,
          sqcand: cand.sqcand ?? null,
          nome: cand.nm,
          nomeUrna: cand.nmu ?? cand.nm,
          partido: partido.nm ?? partido.sg ?? "",
          siglaPartido: partido.sg ?? "",
          federacao: isFederacao
            ? (agr.com ?? agr.nm ?? null)
            : partido.nfed
              ? (federacoes.get(partido.nfed) ?? null)
              : null,
          coligacao: isColigacao ? (agr.com ?? agr.nm ?? null) : null,
          composicao: agr.com ?? null,
          votos: toNumber(cand.vap),
          percentual: toNumber(cand.pvap),
          posicao: 0,
          eleito: toBool(cand.e),
          matematicamenteEleito: false,
          matematicamenteSegundoTurno: false,
          segundoTurnoOficial: ehSegundoTurnoOficial(cand.st),
          situacao: cand.st ?? null,
          vice: vice ? (vice.nmu ?? vice.nm ?? null) : null,
          suplentes,
        });
      }
    }
  }

  // Ranking por votos; empates (inclusive todos zerados) caem na ordem
  // alfabética do nome de urna — evita expor a ordem arbitrária do arquivo do TSE.
  candidatos.sort(
    (a, b) =>
      b.votos - a.votos || a.nomeUrna.localeCompare(b.nomeUrna, "pt-BR"),
  );
  candidatos.forEach((c, i) => {
    c.posicao = i + 1;
  });
  return candidatos;
}

/** Normaliza o JSON bruto do TSE em uma estrutura estável. */
export function normalizeResultado(raw: RawResultado): RaceResult {
  const carg = raw.carg[0];
  return {
    eleicao: toNumber(raw.ele),
    cargo: toNumber(carg?.cd),
    uf: (raw.cdabr ?? "br").toLowerCase(),
    abrangencia: abrangenciaFrom(raw),
    geracao: raw.idg ?? null,
    atualizadoEm: parseDataHora(raw.dg, raw.hg),
    andamento: raw.and ?? "n",
    totalizacaoFinal: toBool(raw.tf),
    divulgarVotacao: toBool(raw.dv),
    secoes: normalizeSecoes(raw),
    eleitorado: normalizeEleitorado(raw),
    votos: normalizeVotos(raw),
    candidatos: normalizeCandidatos(raw),
  };
}

/** Resumo de uma corrida para o painel inicial. */
export function summarizeRace(race: RaceResult): RaceSummary {
  const primeiro = race.candidatos[0];
  // Só existe "liderança" quando há votos computados. Antes disso, a ordem é
  // apenas a ordem do arquivo do TSE e não representa posição nenhuma.
  const lider = primeiro && primeiro.votos > 0 ? primeiro : undefined;
  return {
    eleicao: race.eleicao,
    cargo: race.cargo,
    uf: race.uf,
    atualizadoEm: race.atualizadoEm,
    totalizacaoFinal: race.totalizacaoFinal,
    percentualApurado: race.secoes.percentualTotalizadas,
    votosValidos: race.votos.validos,
    comparecimento: race.eleitorado.comparecimento,
    lider: lider
      ? {
          numero: lider.numero,
          nomeUrna: lider.nomeUrna,
          partido: lider.siglaPartido,
          votos: lider.votos,
          percentual: lider.percentual,
        }
      : null,
  };
}

/** Extrai um snapshot leve para séries temporais. */
export function snapshotFrom(
  race: RaceResult,
  capturadoEm = new Date().toISOString(),
): Snapshot {
  const lider = race.candidatos[0];
  return {
    eleicao: race.eleicao,
    cargo: race.cargo,
    uf: race.uf,
    geracao: race.geracao,
    capturadoEm,
    percentualApurado: race.secoes.percentualTotalizadas,
    votosValidos: race.votos.validos,
    lider: lider
      ? { numero: lider.numero, nomeUrna: lider.nomeUrna, votos: lider.votos }
      : null,
  };
}

/** Normaliza o arquivo de municípios/zonas por UF. */
export function normalizeMunicipios(raw: RawMunicipioFile): UfMunicipios[] {
  return raw.abr.map((a) => {
    const uf = a.cd.toLowerCase();
    const municipios: Municipio[] = a.mu.map((m) => ({
      cd: m.cd,
      cdi: m.cdi ?? null,
      nome: m.nm ?? m.cd,
      zonas: m.z ?? [],
      uf,
    }));
    municipios.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    return { uf, nome: a.ds ?? uf.toUpperCase(), municipios };
  });
}
