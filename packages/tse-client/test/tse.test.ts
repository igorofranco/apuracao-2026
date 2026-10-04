import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TSE_JWS_PUBLIC_KEY } from "@apuracao/shared";
import { JwsError, decodeJwsPayload, resultadoPath, verifyJws } from "../src/index.ts";

describe("urls", () => {
  it("monta o caminho de resultado estadual", () => {
    expect(
      resultadoPath({ ciclo: "ele2026", cdEleicao: 6259, cargo: 3, uf: "SP" }),
    ).toBe(
      "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json",
    );
  });

  it("monta o caminho presidencial (agregado Brasil)", () => {
    expect(
      resultadoPath({ ciclo: "ele2026", cdEleicao: 6257, cargo: 1, uf: "br" }),
    ).toContain("/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json");
  });

  it("inclui município e zona no drill-down", () => {
    expect(
      resultadoPath({
        ciclo: "ele2026",
        cdEleicao: 6259,
        cargo: 3,
        uf: "sp",
        municipio: "71072",
        zona: "1",
      }),
    ).toBe(
      "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp71072-z0001-c0003-e006259-u.json",
    );
  });
});

describe("verificação JWS (Ed25519)", () => {
  const fixture = readFileSync(
    new URL("./fixtures/ele-c.jws", import.meta.url),
    "utf8",
  ).trim();

  it("valida a assinatura oficial e extrai o payload", () => {
    const payload = verifyJws(fixture, TSE_JWS_PUBLIC_KEY);
    expect(payload).toContain("ele2026");
    expect(decodeJwsPayload(fixture)).toBe(payload);
  });

  it("rejeita payload adulterado", () => {
    const [header, payload, signature] = fixture.split(".");
    const adulterado = `${header}.${payload!.slice(0, -2)}AA.${signature}`;
    expect(() => verifyJws(adulterado, TSE_JWS_PUBLIC_KEY)).toThrow(JwsError);
  });
});
