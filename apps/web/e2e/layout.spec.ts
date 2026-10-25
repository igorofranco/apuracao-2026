import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/**
 * Home em tela única em qualquer orientação.
 *
 * Em paisagem (lado maior horizontal) o placar fica ao lado do mapa; em
 * retrato (lado maior vertical) o placar fica acima. Em ambos, tudo precisa
 * caber na viewport, sem scroll nem conteúdo cortado.
 */

const TAMANHOS = [
  // Desktops, do ultrawide ao notebook baixo.
  { nome: "desktop-1920x1080", width: 1920, height: 1080 },
  { nome: "desktop-1440x900", width: 1440, height: 900 },
  { nome: "desktop-1280x800", width: 1280, height: 800 },
  { nome: "notebook-1366x768", width: 1366, height: 768 },
  // Tablets nas duas orientações.
  { nome: "tablet-1180x820-deitado", width: 1180, height: 820 },
  { nome: "tablet-1024x768-deitado", width: 1024, height: 768 },
  { nome: "tablet-820x1180-em-pe", width: 820, height: 1180 },
  { nome: "tablet-768x1024-em-pe", width: 768, height: 1024 },
  // Monitor vertical.
  { nome: "monitor-1080x1920-em-pe", width: 1080, height: 1920 },
  // Celulares (inclusive deitado, que é o caso mais apertado).
  { nome: "celular-844x390-deitado", width: 844, height: 390 },
  { nome: "celular-390x844", width: 390, height: 844 },
  { nome: "celular-360x800", width: 360, height: 800 },
  { nome: "celular-320x720", width: 320, height: 720 },
];

interface Retangulo {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Medidas {
  home: Retangulo;
  hero: Retangulo;
  map: Retangulo;
  cartoes: Retangulo[];
  overflowHero: number;
  overflowMapa: number;
  overflowCartoes: number;
  docLargura: number;
  docAltura: number;
}

function medir(page: Page): Promise<Medidas> {
  return page.evaluate(() => {
    const retangulo = (el: Element) => {
      const b = el.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
        left: b.left,
      };
    };
    const home = document.querySelector("[data-home]")!;
    const hero = document.querySelector(
      '[data-testid="presidente-segundo-turno"]',
    )!;
    const mapa = document.querySelector('[data-testid="mapa-presidente"]')!;
    const cartoes = [...document.querySelectorAll('[data-testid="candidato-destaque"]')];
    const overflow = (el: Element) => el.scrollHeight - el.clientHeight;
    return {
      home: retangulo(home),
      hero: retangulo(hero),
      map: retangulo(mapa),
      cartoes: cartoes.map(retangulo),
      overflowHero: overflow(hero),
      overflowMapa: overflow(mapa),
      overflowCartoes: Math.max(0, ...cartoes.map(overflow)),
      docLargura: document.documentElement.scrollWidth,
      docAltura: document.documentElement.scrollHeight,
    };
  });
}

test.describe("home em tela única", () => {
  test("cabe sem scroll e respeita a orientação", async ({
    page,
    context,
  }, testInfo) => {
    // As capturas cobrem muitos tamanhos de uma vez; rodar só uma vez basta.
    test.skip(
      testInfo.project.name !== "desktop",
      "a matriz de tamanhos roda uma única vez, no projeto desktop",
    );

    // Votação simulada: deixa o heatmap colorido nas capturas.
    await context.addCookies([
      { name: "mock_municipios", value: "1", url: "http://localhost:3000" },
    ]);

    const dir = "e2e/screenshots/layout";
    mkdirSync(dir, { recursive: true });

    for (const t of TAMANHOS) {
      await test.step(t.nome, async () => {
        await page.setViewportSize({ width: t.width, height: t.height });
        await page.goto("/", { waitUntil: "domcontentloaded" });

        const hero = page.getByTestId("presidente-segundo-turno").first();
        const mapa = page.getByTestId("mapa-presidente").first();
        await expect(hero).toBeVisible({ timeout: 20_000 });
        await expect(mapa).toBeVisible({ timeout: 20_000 });

        // Espera a malha municipal (quando disponível) para a captura.
        await expect
          .poll(
            async () => {
              const camada = mapa.getByTestId("mapa-municipios-brasil");
              if ((await camada.count()) === 0) return 0;
              return Number(
                (await camada.getAttribute("data-municipios")) ?? "0",
              );
            },
            { timeout: 20_000 },
          )
          .toBeGreaterThan(5_000)
          .catch(() => {});

        await page.waitForTimeout(400);
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation:none!important;transition:none!important}",
        });

        const m = await medir(page);
        const paisagem = t.width > t.height;

        // Nada de scroll (vertical ou horizontal) e nada cortado embaixo.
        expect(m.docAltura, `${t.nome}: scroll vertical`).toBeLessThanOrEqual(
          t.height + 1,
        );
        expect(m.docLargura, `${t.nome}: scroll horizontal`).toBeLessThanOrEqual(
          t.width + 1,
        );
        expect(m.home.bottom, `${t.nome}: painel passou da viewport`).toBeLessThanOrEqual(
          t.height + 1,
        );
        expect(m.hero.bottom, `${t.nome}: placar passou da viewport`).toBeLessThanOrEqual(
          t.height + 1,
        );
        expect(m.map.bottom, `${t.nome}: mapa passou da viewport`).toBeLessThanOrEqual(
          t.height + 1,
        );
        expect(m.hero.right, `${t.nome}: placar passou da lateral`).toBeLessThanOrEqual(
          t.width + 1,
        );
        expect(m.map.right, `${t.nome}: mapa passou da lateral`).toBeLessThanOrEqual(
          t.width + 1,
        );

        // Conteúdo interno não vaza (era o caso do celular deitado).
        expect(m.overflowHero, `${t.nome}: conteúdo vazou do placar`).toBeLessThanOrEqual(1);
        expect(m.overflowMapa, `${t.nome}: conteúdo vazou do mapa`).toBeLessThanOrEqual(1);
        expect(
          m.overflowCartoes,
          `${t.nome}: conteúdo vazou de um cartão`,
        ).toBeLessThanOrEqual(1);

        // Orientação: paisagem = lado a lado; retrato = empilhado.
        if (paisagem) {
          expect(
            m.map.x,
            `${t.nome}: em paisagem o mapa deve ficar à direita do placar`,
          ).toBeGreaterThanOrEqual(m.hero.right - 1);
          expect(
            Math.min(m.hero.bottom, m.map.bottom) -
              Math.max(m.hero.top, m.map.top),
            `${t.nome}: placar e mapa devem dividir a mesma altura`,
          ).toBeGreaterThan(0);
        } else {
          expect(
            m.map.y,
            `${t.nome}: em retrato o mapa deve ficar abaixo do placar`,
          ).toBeGreaterThanOrEqual(m.hero.bottom - 1);
          expect(
            Math.min(m.hero.right, m.map.right) -
              Math.max(m.hero.left, m.map.left),
            `${t.nome}: placar e mapa devem dividir a mesma largura`,
          ).toBeGreaterThan(0);
        }

        // Os dois cartões do 2º turno não se sobrepõem.
        if (m.cartoes.length === 2) {
          const a = m.cartoes[0]!;
          const b = m.cartoes[1]!;
          const separados =
            b.y >= a.bottom - 1 || b.x >= a.right - 1 || a.y >= b.bottom - 1;
          expect(separados, `${t.nome}: cartões sobrepostos`).toBe(true);
        }

        // O rodapé legal sai da tela única.
        await expect(page.locator("footer")).toHaveCSS("display", "none");

        await page.screenshot({
          path: `${dir}/${t.nome}.png`,
          fullPage: true,
        });

        // A mesma seção, na visão Gráfico: duas linhas e nada de scroll.
        const secao = page.getByTestId("mapa-presidente").first();
        await secao.getByRole("button", { name: "Gráfico" }).click();
        await expect(secao).toHaveAttribute("data-visao", "grafico");
        const grafico = secao.getByTestId("grafico-evolucao");
        await expect(grafico).toBeVisible();
        await expect(grafico).toHaveAttribute("data-estado", "pronto", {
          timeout: 20_000,
        });
        await expect(grafico.locator(".recharts-line-curve")).toHaveCount(2, {
          timeout: 20_000,
        });

        const mg = await medir(page);
        expect(mg.docAltura, `${t.nome}: scroll vertical (gráfico)`).toBeLessThanOrEqual(
          t.height + 1,
        );
        expect(mg.docLargura, `${t.nome}: scroll horizontal (gráfico)`).toBeLessThanOrEqual(
          t.width + 1,
        );
        expect(
          mg.map.bottom,
          `${t.nome}: gráfico passou da viewport`,
        ).toBeLessThanOrEqual(t.height + 1);
        expect(
          mg.overflowMapa,
          `${t.nome}: conteúdo vazou do gráfico`,
        ).toBeLessThanOrEqual(1);

        await page.screenshot({
          path: `${dir}/${t.nome}-grafico.png`,
          fullPage: true,
        });
      });
    }
  });
});
