import { describe, expect, it } from "vitest";
import type { TseClient } from "@apuracao/tse-client";
import { normalizeResultado, type RawResultado } from "@apuracao/domain";
import { loadConfig } from "../src/config.ts";
import { LocalidadesCache } from "../src/localidades.ts";
import { Logger } from "../src/logger.ts";
import { MunicipiosCache } from "../src/municipios.ts";
import { buildServer } from "../src/server.ts";
import { RaceStore } from "../src/store.ts";
import type { Poller, PollerStats } from "../src/poller.ts";
import type { EleicoesResolvidas } from "../src/eleicoes.ts";

const eleicoes: EleicoesResolvidas = {
  ciclo: "ele2026",
  federal: { cd: 6257, turno: 1, data: null, nome: "Federal" },
  estadual: { cd: 6259, turno: 1, data: null, nome: "Estadual" },
  doConfig: false,
};

function raw(cargo: number, uf: string, vap: string): RawResultado {
  return {
    ele: cargo === 1 ? "6257" : "6259",
    t: "1",
    tpabr: uf === "br" ? "br" : "uf",
    cdabr: uf,
    dg: "04/10/2026",
    hg: "18:00:00",
    idg: "100",
    and: "s",
    tf: "n",
    dv: "s",
    carg: [
      {
        cd: String(cargo),
        nmn: cargo === 1 ? "Presidente" : "Governador",
        agr: [
          {
            n: "1",
            tp: "i",
            par: [
              {
                n: "22",
                sg: "PL",
                nm: "PARTIDO LIBERAL",
                cand: [
                  { n: "22", nm: "FULANO DE TAL", nmu: "FULANO", vap, pvap: "100,00", e: "s" },
                ],
              },
            ],
          },
        ],
        s: { ts: "100", st: "50", pst: "50,00" },
        e: { te: "1000", esa: "500", pesa: "50,00" },
        v: { vv: vap, vnom: vap },
      },
    ],
  } as RawResultado;
}

const statsVazio: PollerStats = {
  running: true,
  runs: 0,
  lastRunAt: null,
  lastDurationMs: 0,
  lastChanged: 0,
  totalUpdates: 0,
  failures: 0,
  jwsFailures: 0,
  notFound: 0,
  consecutiveFailures: 0,
  backoffMs: 0,
  lastError: null,
};

function fakeClient(): TseClient {
  let chamadas = 0;
  const client = {
    getResultado: async (o: { cargo: number; uf: string; municipio?: string }) => {
      chamadas += 1;
      return raw(o.cargo, o.uf, o.municipio ? "123" : "10");
    },
    getMunicipios: async () => null,
    getConfig: async () => ({ pl: [] }),
    get chamadas() {
      return chamadas;
    },
  };
  return client as unknown as TseClient;
}

async function montarApp(rateMax = 1000) {
  const config = loadConfig({ CORS_ORIGIN: "http://localhost:3000" } as NodeJS.ProcessEnv);
  config.rateLimit.max = rateMax;
  const store = new RaceStore({ snapshotLimit: 100 });
  const client = fakeClient();
  const log = new Logger({ level: "error" });
  const poller = { stats: { ...statsVazio } } as unknown as Poller;
  const app = await buildServer({
    config,
    store,
    poller,
    client,
    municipios: new MunicipiosCache(client, "ele2026"),
    localidades: new LocalidadesCache(client, 60_000),
    eleicoes,
    log,
    flags: { redis: false, postgres: false },
  });
  return { app, store, client };
}

describe("collector HTTP", () => {
  it("expõe /api/config com UFs e cargos", async () => {
    const { app } = await montarApp();
    const res = await app.inject({ method: "GET", url: "/api/config" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ufs.length).toBe(27);
    expect(body.cargos.some((c: { codigo: number }) => c.codigo === 1)).toBe(true);
    await app.close();
  });

  it("serve /api/resumo a partir do store", async () => {
    const { app, store } = await montarApp();
    store.setRace(normalizeResultado(raw(1, "br", "10")));
    const res = await app.inject({ method: "GET", url: "/api/resumo" });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
    await app.close();
  });

  it("responde 404 para corrida inexistente", async () => {
    const { app } = await montarApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/resultado?eleicao=6257&cargo=1&uf=br",
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("busca localidade sob demanda e faz cache (dedupe)", async () => {
    const { app, client } = await montarApp();
    const url = "/api/resultado?eleicao=6259&cargo=3&uf=sp&municipio=71072";
    const r1 = await app.inject({ method: "GET", url });
    const r2 = await app.inject({ method: "GET", url });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json().candidatos[0].votos).toBe(123);
    // segunda chamada veio do cache
    expect((client as unknown as { chamadas: number }).chamadas).toBe(1);
    await app.close();
  });

  it("aplica rate limit", async () => {
    const { app } = await montarApp(2);
    const respostas = [];
    for (let i = 0; i < 5; i++) {
      respostas.push((await app.inject({ method: "GET", url: "/health" })).statusCode);
    }
    expect(respostas).toContain(429);
    await app.close();
  });
});
