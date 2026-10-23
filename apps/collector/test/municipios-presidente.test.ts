import { describe, expect, it } from "vitest";
import type { RawResultado } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";
import type { EleicoesResolvidas } from "../src/eleicoes.ts";
import { Logger } from "../src/logger.ts";
import type { MunicipiosCache } from "../src/municipios.ts";
import { MunicipiosPresidente } from "../src/municipios-presidente.ts";

const eleicoes: EleicoesResolvidas = {
  ciclo: "ele2026",
  federal: { cd: 6258, turno: 2, data: null, nome: "Federal" },
  estadual: { cd: 6260, turno: 2, data: null, nome: "Estadual" },
  primeiroTurno: {
    federal: { cd: 6257, turno: 1, data: null, nome: "Federal" },
    estadual: { cd: 6259, turno: 1, data: null, nome: "Estadual" },
  },
  doConfig: true,
};

function municipio(cd: string, cdi: string | null, nome: string) {
  return { cd, cdi, nome, zonas: [], uf: "" };
}

function resultado(votosLula: number, votosFlavio: number): RawResultado {
  return {
    ele: "6258",
    t: "2",
    tpabr: "mu",
    cdabr: "71072",
    dg: "25/10/2026",
    hg: "19:42:00",
    idg: "1",
    and: "s",
    tf: "n",
    dv: "s",
    carg: [
      {
        cd: "1",
        nmn: "Presidente",
        agr: [
          {
            n: "1",
            tp: "i",
            par: [
              {
                n: "13",
                sg: "PT",
                nm: "PARTIDO DOS TRABALHADORES",
                cand: [
                  {
                    n: "13",
                    nm: "LUIZ INACIO LULA DA SILVA",
                    nmu: "LULA",
                    vap: String(votosLula),
                    pvap: "50,00",
                  },
                ],
              },
              {
                n: "22",
                sg: "PL",
                nm: "PARTIDO LIBERAL",
                cand: [
                  {
                    n: "22",
                    nm: "FLAVIO NANTES BOLSONARO",
                    nmu: "FLAVIO BOLSONARO",
                    vap: String(votosFlavio),
                    pvap: "50,00",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    v: {
      vv: String(votosLula + votosFlavio),
      vnom: String(votosLula + votosFlavio),
    },
  } as unknown as RawResultado;
}

function fakeClient(): TseClient {
  let chamadas = 0;
  const client = {
    getResultado: async (o: { municipio?: string; uf: string }) => {
      chamadas += 1;
      if (o.municipio === "71072") return resultado(600, 400);
      if (o.municipio === "60001") return resultado(450, 550);
      return resultado(10, 10);
    },
    get chamadas() {
      return chamadas;
    },
  };
  return client as unknown as TseClient;
}

function fakeMunicipios(): MunicipiosCache {
  return {
    get: async () => [
      {
        uf: "sp",
        nome: "São Paulo",
        municipios: [
          municipio("71072", "3550308", "SÃO PAULO"),
          municipio("60001", "3509502", "CAMPINAS"),
        ],
      },
      {
        uf: "ac",
        nome: "Acre",
        municipios: [municipio("01120", "1200013", "ACRELÂNDIA")],
      },
      {
        uf: "zz",
        nome: "Exterior",
        municipios: [municipio("00001", null, "EXTERIOR")],
      },
    ],
  } as unknown as MunicipiosCache;
}

function criar(client: TseClient = fakeClient()) {
  return new MunicipiosPresidente({
    client,
    municipios: fakeMunicipios(),
    eleicoes,
    log: new Logger({ level: "error" }),
    intervalMs: 0,
    refreshMs: 0,
    once: true,
  });
}

describe("MunicipiosPresidente", () => {
  it("varre os municípios e monta o snapshot por UF", async () => {
    const service = criar();
    await service.rodarUmaVez();

    const sp = service.snapshot(6258, "sp");
    expect(sp).not.toBeNull();
    expect(sp?.total).toBe(2);
    expect(sp?.coletados).toBe(2);
    expect(sp?.preparando).toBe(false);
    expect(sp?.municipios.map((m) => m.nome)).toEqual(["CAMPINAS", "SÃO PAULO"]);

    const saoPaulo = sp?.municipios.find((m) => m.cd === "71072");
    expect(saoPaulo).toMatchObject({
      cdi: "3550308",
      votosValidos: 1000,
      semDados: false,
      votos: { "13": 600, "22": 400 },
    });

    // O exterior não entra no mapa.
    expect(service.snapshot(6258, "zz")?.total).toBe(0);
  });

  it("monta o snapshot nacional compacto por candidato", async () => {
    const service = criar();
    await service.rodarUmaVez();

    const brasil = service.snapshotBrasil(6258, "13", "22");
    expect(brasil).not.toBeNull();
    expect(brasil?.candidatos).toEqual(["13", "22"]);
    expect(brasil?.total).toBe(3);
    expect(brasil?.coletados).toBe(3);
    expect(brasil?.porUf.sp).toMatchObject({ total: 2, coletados: 2 });
    expect(brasil?.porUf.ac).toMatchObject({ total: 1, coletados: 1 });
    // Ordenado por cdi para o payload ser estável entre requisições.
    expect(brasil?.municipios).toEqual([
      ["1200013", "ac", 10, 10],
      ["3509502", "sp", 450, 550],
      ["3550308", "sp", 600, 400],
    ]);
    expect(brasil?.municipios[2]?.[2]).toBe(600);
    expect(brasil?.municipios[2]?.[3]).toBe(400);

    // Mesma revisão/candidatos: reaproveita o objeto memorizado.
    expect(service.snapshotBrasil(6258, "13", "22")).toBe(brasil);
  });

  it("conta ciclos e progresso sem expor o payload pesado", async () => {
    const service = criar();
    expect(await service.rodarUmaVez()).toBe(true);
    // O contador de ciclos é do loop contínuo; rodarUmaVez isolado não conta.
    expect(service.stats.coletados).toBe(3);
    expect(service.stats.revisao).toBe(3);
    const progresso = service.progresso(6258);
    expect(progresso).toMatchObject({
      total: 3,
      coletados: 3,
      preparando: false,
    });
    expect(progresso?.porUf.sp).toMatchObject({ total: 2, coletados: 2 });
  });

  it("recomeça a varredura depois de concluir a fila", async () => {
    const client = fakeClient();
    const service = criar(client);
    expect(await service.rodarUmaVez()).toBe(true);
    expect(await service.rodarUmaVez()).toBe(true);
    // 3 municípios × 2 varreduras; a lista só é carregada uma vez.
    expect((client as unknown as { chamadas: number }).chamadas).toBe(6);
  });

  it("ignora eleição diferente e UF sem dados", () => {
    const service = criar();
    expect(service.snapshot(6257, "sp")).toBeNull();
    const vazio = service.snapshot(6258, "rj");
    expect(vazio).toMatchObject({ total: 0, coletados: 0, preparando: true });
  });

  it("guarda municípios sem arquivo no TSE como sem dados", async () => {
    const service = new MunicipiosPresidente({
      client: {
        getResultado: async () => null,
      } as unknown as TseClient,
      municipios: fakeMunicipios(),
      eleicoes,
      log: new Logger({ level: "error" }),
      intervalMs: 0,
      refreshMs: 0,
      once: true,
    });
    await service.rodarUmaVez();
    const sp = service.snapshot(6258, "sp");
    expect(sp?.coletados).toBe(2);
    expect(sp?.municipios.every((m) => m.semDados)).toBe(true);
    expect(sp?.municipios[0]?.votos).toEqual({});
  });
});
