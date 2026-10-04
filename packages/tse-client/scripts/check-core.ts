import { TseClient } from "@apuracao/tse-client";
import { normalizeResultado, summarizeRace, normalizeMunicipios } from "@apuracao/domain";
import { findPleito, listEleicoes } from "@apuracao/tse-client";

const client = new TseClient({ verifyJws: true });
const t0 = Date.now();
const cfg = await client.getConfig("ele2026");
console.log("config OK em", Date.now() - t0, "ms | pleitos:", cfg.pl.length);
const pleito = findPleito(cfg, "ele2026")!;
console.log("pleito 2026 cd=", pleito.cd, "eleicoes:", listEleicoes(pleito).map(e => `${e.cd}:${e.nm}`).join(" | "));

const raw = await client.getResultado({ ciclo: "ele2026", cdEleicao: 6257, cargo: 1, uf: "br" });
if (!raw) throw new Error("sem resultado");
const race = normalizeResultado(raw);
console.log("Presidente:", race.candidatos.length, "candidates | geracao", race.geracao, "| and", race.andamento, "| secoes", race.secoes.totalizadas, "/", race.secoes.total, "| atualizadoEm", race.atualizadoEm);
console.log("top:", race.candidatos.slice(0, 5).map(c => `${c.posicao}. ${c.nomeUrna} (${c.siglaPartido}) ${c.votos} ${c.percentual}%${c.eleito ? " ELEITO" : ""}`).join("\n     "));
console.log("resumo:", JSON.stringify(summarizeRace(race)));

const mun = await client.getMunicipios("ele2026", 6257);
if (mun) { const ufs = normalizeMunicipios(mun); console.log("municipios: UFs", ufs.length, "| SP tem", ufs.find(u => u.uf === "sp")?.municipios.length, "municipios | 1o:", ufs.find(u=>u.uf==="sp")?.municipios[0]?.nome); }
