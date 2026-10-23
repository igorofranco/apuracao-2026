import { afterEach, describe, expect, it, vi } from "vitest";
import type { TseClient } from "@apuracao/tse-client";
import { loadConfig } from "../src/config.ts";
import { estaEmApuracao, resolverEleicoes } from "../src/eleicoes.ts";
import { Logger } from "../src/logger.ts";

/**
 * O config de 2026 vem em dois blocos com o mesmo `c` ("ele2026"): o primeiro
 * com o 1º turno/municipal e o segundo com o 2º turno + suplementares. Antes,
 * `findPleito` pegava só o primeiro e a coleta ficava presa no 1º turno.
 */
const config = {
  pl: [
    {
      c: "ele2026",
      e: [
        { cd: "6257", tp: "8", t: "1", nm: "Federal · 1º turno" },
        { cd: "6259", tp: "1", t: "1", nm: "Estadual · 1º turno" },
        { cd: "6261", tp: "3", t: "1", nm: "Municipal" },
      ],
    },
    {
      c: "ele2026",
      e: [
        { cd: "6260", tp: "1", t: "2", nm: "Estadual · 2º turno" },
        { cd: "6258", tp: "8", t: "2", nm: "Federal · 2º turno" },
      ],
    },
  ],
};

function fakeClient(): TseClient {
  return {
    getConfig: async () => config,
  } as unknown as TseClient;
}

describe("resolverEleicoes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("junta os blocos do mesmo pleito e adota o 2º turno", async () => {
    vi.stubEnv("TSE_ELEICOES_AUTO", "true");
    vi.stubEnv("TSE_CICLO", "ele2026");
    const cfg = loadConfig({} as NodeJS.ProcessEnv);
    const eleicoes = await resolverEleicoes(
      fakeClient(),
      cfg,
      new Logger({ level: "error" }),
    );

    expect(eleicoes.doConfig).toBe(true);
    expect(eleicoes.federal).toMatchObject({
      cd: 6258,
      turno: 2,
      // O config do 2º turno não traz `dt`; a data do calendário preenche.
      data: "2026-10-25T17:00:00-03:00",
    });
    expect(eleicoes.estadual).toMatchObject({ cd: 6260, turno: 2 });
    expect(eleicoes.primeiroTurno?.federal.cd).toBe(6257);
    expect(eleicoes.primeiroTurno?.estadual.cd).toBe(6259);

    expect(
      estaEmApuracao(eleicoes, new Date("2026-10-25T19:00:00-03:00")),
    ).toBe(true);
    expect(
      estaEmApuracao(eleicoes, new Date("2026-10-20T19:00:00-03:00")),
    ).toBe(false);
  });
});
