import { afterEach, describe, expect, it, vi } from "vitest";
import type { TseClient } from "@apuracao/tse-client";
import { normalizeResultado, type RawResultado, type Snapshot } from "@apuracao/domain";
import { loadConfig } from "../src/config.ts";
import { LocalidadesCache } from "../src/localidades.ts";
import { Logger } from "../src/logger.ts";
import { MunicipiosCache } from "../src/municipios.ts";
import type { MunicipiosPresidente } from "../src/municipios-presidente.ts";
import { buildServer } from "../src/server.ts";
import { RaceStore, type SnapshotRepository } from "../src/store.ts";
import type { Poller, PollerStats } from "../src/poller.ts";
import {
  eleicoesSegundoTurno2026,
  type EleicoesResolvidas,
} from "../src/eleicoes.ts";

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
  alvos: 0,
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

async function montarApp(
  rateMax = 1000,
  eleicoesCfg: EleicoesResolvidas = eleicoes,
) {
  const config = loadConfig({ CORS_ORIGIN: "http://localhost:3000" } as NodeJS.ProcessEnv);
  config.rateLimit.max = rateMax;
  const store = new RaceStore({ snapshotLimit: 100 });
  const client = fakeClient();
  const log = new Logger({ level: "error" });
  const poller = { stats: { ...statsVazio } } as unknown as Poller;
  const municipiosPresidente = {
    snapshot: (eleicao: number, uf: string) => ({
      eleicao,
      cargo: 1,
      uf,
      total: 0,
      coletados: 0,
      preparando: true,
      atualizadoEm: null,
      municipios: [],
    }),
    snapshotBrasil: (eleicao: number, a: string, b: string) => ({
      eleicao,
      cargo: 1,
      candidatos: [a, b],
      total: 0,
      coletados: 0,
      preparando: true,
      revisao: 0,
      ciclos: 0,
      atualizadoEm: null,
      porUf: {},
      municipios: [],
    }),
    progresso: (eleicao: number) => ({
      eleicao,
      cargo: 1,
      total: 0,
      coletados: 0,
      preparando: true,
      revisao: 0,
      ciclos: 0,
      atualizadoEm: null,
      porUf: {},
    }),
    stats: {
      total: 0,
      coletados: 0,
      preparando: true,
      revisao: 0,
      ciclos: 0,
      atualizadoEm: null,
      ultimaConclusao: null,
      ultimaDuracaoMs: 0,
      falhas: 0,
      rodando: false,
    },
  } as unknown as MunicipiosPresidente;
  const app = await buildServer({
    config,
    store,
    poller,
    client,
    municipios: new MunicipiosCache(client, "ele2026"),
    localidades: new LocalidadesCache(client, 60_000),
    municipiosPresidente,
    eleicoes: eleicoesCfg,
    log,
    flags: { redis: false, redisOk: false, postgres: false },
  });
  return { app, store, client };
}

afterEach(() => vi.useRealTimers());

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

  it("serve o cache municipal por UF e o snapshot nacional compacto", async () => {
    const { app } = await montarApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/presidente/municipios?eleicao=6257&uf=sp",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      eleicao: 6257,
      cargo: 1,
      uf: "sp",
      total: 0,
      preparando: true,
    });

    const nacional = await app.inject({
      method: "GET",
      url: "/api/presidente/municipios?eleicao=6257&a=13&b=22",
    });
    expect(nacional.statusCode).toBe(200);
    expect(nacional.headers["etag"]).toBeTruthy();
    expect(nacional.json()).toMatchObject({
      eleicao: 6257,
      cargo: 1,
      candidatos: ["13", "22"],
      total: 0,
      municipios: [],
    });

    // Revalidação: o mesmo ETag responde 304 sem corpo.
    const revalidado = await app.inject({
      method: "GET",
      url: "/api/presidente/municipios?eleicao=6257&a=13&b=22",
      headers: { "if-none-match": nacional.headers["etag"] as string },
    });
    expect(revalidado.statusCode).toBe(304);

    const semCandidatos = await app.inject({
      method: "GET",
      url: "/api/presidente/municipios?eleicao=6257",
    });
    expect(semCandidatos.statusCode).toBe(400);
    await app.close();
  });

  it("bloqueia rotas que tocam no TSE antes de domingo às 16h", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T15:00:00-03:00"));
    const { app } = await montarApp(1000, eleicoesSegundoTurno2026());
    const antes = await app.inject({
      method: "GET",
      url: "/api/municipios?eleicao=6258&uf=sp",
    });
    expect(antes.statusCode).toBe(503);
    await app.close();

    vi.setSystemTime(new Date("2026-10-25T16:00:01-03:00"));
    const { app: liberado } = await montarApp(
      1000,
      eleicoesSegundoTurno2026(),
    );
    const depois = await liberado.inject({
      method: "GET",
      url: "/api/municipios?eleicao=6258&uf=sp",
    });
    expect(depois.statusCode).toBe(200);
    await liberado.close();
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

function fakeRepo(): SnapshotRepository & { snaps: Snapshot[]; pruned: number[] } {
  const snaps: Snapshot[] = [];
  const pruned: number[] = [];
  return {
    snaps,
    pruned,
    save(s) {
      snaps.push(s);
    },
    async loadRecent() {
      return snaps;
    },
    async history(f) {
      return snaps.filter(
        (s) => s.eleicao === f.eleicao && s.cargo === f.cargo && s.uf === f.uf,
      );
    },
    async prune(days) {
      pruned.push(days);
      return 3;
    },
  };
}

describe("histórico durável (Postgres)", () => {
  it("persiste somente quando a geração muda", () => {
    const repo = fakeRepo();
    const store = new RaceStore({ snapshotLimit: 100, repo });
    store.setRace(normalizeResultado(raw(1, "br", "10")));
    expect(repo.snaps.length).toBe(1);
    store.setRace(normalizeResultado(raw(1, "br", "10"))); // mesma assinatura
    expect(repo.snaps.length).toBe(1);
  });

  it("serve o histórico do repositório e cai para a memória", async () => {
    const repo = fakeRepo();
    const store = new RaceStore({ snapshotLimit: 100, repo });
    store.setRace(normalizeResultado(raw(1, "br", "10")));
    const doRepo = await store.historicoAsync(6257, 1, "br", {
      limit: 10,
      retentionDays: 7,
    });
    expect(doRepo.length).toBe(1);

    const semRepo = await new RaceStore({ snapshotLimit: 100 }).historicoAsync(
      6257,
      1,
      "br",
      { limit: 10, retentionDays: 7 },
    );
    expect(semRepo.length).toBe(0);
  });

  it("delega a retenção ao repositório", async () => {
    const repo = fakeRepo();
    const store = new RaceStore({ snapshotLimit: 100, repo });
    await expect(store.prune(7)).resolves.toBe(3);
    expect(repo.pruned).toEqual([7]);
  });
});
