import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeMunicipios, normalizeResultado, summarizeRace } from "../src/index.ts";

const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("normalizeResultado", () => {
  const raw = read("presidente-br.json");
  const race = normalizeResultado(raw as never);

  it("identifica eleição, cargo e abrangência", () => {
    expect(race.eleicao).toBe(6257);
    expect(race.cargo).toBe(1);
    expect(race.uf).toBe("br");
    expect(race.abrangencia).toBe("br");
  });

  it("extrai os 12 candidatos da disputa presidencial", () => {
    expect(race.candidatos).toHaveLength(12);
    expect(race.candidatos[0]?.posicao).toBe(1);
  });

  it("converte datas no horário de Brasília", () => {
    expect(race.atualizadoEm).toBe("2026-10-03T14:47:37-03:00");
  });

  it("lê o resumo de seções e eleitorado", () => {
    expect(race.secoes.total).toBe(499248);
    expect(race.eleitorado.total).toBe(158745502);
  });

  it("preenche o resumo com o líder", () => {
    const resumo = summarizeRace(race);
    expect(resumo.lider?.nomeUrna).toBe("FLAVIO BOLSONARO");
    expect(resumo.lider?.partido).toBe("PL");
  });
});

describe("normalizeMunicipios", () => {
  const raw = read("municipios.json");
  const ufs = normalizeMunicipios(raw as never);

  it("agrupa municípios por UF", () => {
    expect(ufs).toHaveLength(2);
    expect(ufs.find((u) => u.uf === "ac")?.municipios).toHaveLength(2);
  });

  it("preserva código IBGE e zonas", () => {
    const sp = ufs.find((u) => u.uf === "sp")?.municipios[0];
    expect(sp?.cdi).toBe("3550308");
    expect(sp?.zonas).toEqual(["0001", "0002"]);
  });
});
