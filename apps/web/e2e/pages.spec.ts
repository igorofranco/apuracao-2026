import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/**
 * Percorre todas as páginas do app, em desktop e mobile, e:
 *  - valida que o conteúdo principal aparece (sem tela de erro/skeleton);
 *  - garante o badge "Ao vivo" (SSE através do proxy do Next);
 *  - falha em erros de console, exceções e requisições de rede falhas;
 *  - garante que não há overflow horizontal (layout mobile respira);
 *  - salva um screenshot full-page para inspeção.
 *
 * A fonte de dados é o mock em e2e/mock-server.mjs (determinístico).
 */

interface Pagina {
  name: string;
  path: string;
  heading?: RegExp;
  texto?: RegExp;
  progresso?: boolean;
  aoVivo?: boolean;
  permitir404?: boolean;
  /** Página com tabela de candidatos (cargo proporcional). */
  tabela?: boolean;
}

const PAGINAS: Pagina[] = [
  {
    name: "painel",
    path: "/",
    heading: /Disputa presidencial/,
    texto: /2º turno/,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "presidente",
    path: "/presidente",
    heading: /Disputa presidencial/,
    texto: /seções totalizadas/i,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "uf-sp",
    path: "/uf/sp",
    heading: /São Paulo/,
    texto: /Municípios/,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "municipio-sp",
    path: "/uf/sp/71072",
    heading: /São Paulo/,
    texto: /Zonas eleitorais/,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "zona-sp",
    path: "/uf/sp/71072/zona/1",
    heading: /Zona 1/,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "uf-df",
    path: "/uf/df",
    heading: /Distrito Federal/,
    texto: /Dep\. Distrital/,
    progresso: true,
    aoVivo: true,
  },
  {
    name: "uf-sp-dep-federal",
    path: "/uf/sp?cargo=6",
    heading: /São Paulo/,
    texto: /Deputado Federal/,
    progresso: true,
    aoVivo: true,
    tabela: true,
  },
  {
    name: "uf-df-dep-distrital",
    path: "/uf/df?cargo=8",
    heading: /Distrito Federal/,
    texto: /Deputado Distrital/,
    progresso: true,
    aoVivo: true,
    tabela: true,
  },
  {
    name: "nao-encontrado",
    path: "/rota-que-nao-existe",
    heading: /Página não encontrada/,
    aoVivo: false,
    permitir404: true,
  },
  {
    name: "uf-invalida",
    path: "/uf/zz",
    texto: /UF inválida/,
    aoVivo: false,
  },
];

const IGNORAR_CONSOLE: RegExp[] = [
  /favicon/i,
  /Download the React DevTools/i,
];

/** Coleta erros relevantes de uma página durante o teste. */
function monitorar(page: Page, opts: { permitir404?: boolean } = {}): string[] {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    if (IGNORAR_CONSOLE.some((r) => r.test(texto))) return;
    // Rotas 404 (ex.: página "não encontrada") registram o próprio status.
    if (opts.permitir404 && /status of 404/.test(texto)) return;
    erros.push(`console.error: ${texto}`);
  });
  page.on("pageerror", (err) => {
    erros.push(`pageerror: ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/favicon/.test(url)) return;
    // O SSE é mantido aberto e abortado no teardown — não é falha real.
    if (/\/api\/live/.test(url)) return;
    // O React StrictMode (dev) aborta a primeira de fetches duplicadas.
    const erro = req.failure()?.errorText ?? "";
    if (/ERR_ABORTED/.test(erro)) return;
    erros.push(`requestfailed: ${url} (${erro || "?"})`);
  });
  return erros;
}

async function semOverflowHorizontal(page: Page): Promise<void> {
  const { scrollW, clientW, visualW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    visualW: Math.round(
      window.visualViewport?.width ?? document.documentElement.clientWidth,
    ),
  }));
  // No mobile o window.innerWidth pode crescer junto com o conteúdo; a
  // referência correta é a largura visível (clientWidth/visualViewport).
  const larguraVisivel = Math.min(clientW, visualW);
  expect(
    scrollW,
    `overflow horizontal: scrollWidth=${scrollW} > largura visível=${larguraVisivel}`,
  ).toBeLessThanOrEqual(larguraVisivel + 1);
}

/** Garante que nenhum rótulo de eixo do Recharts seja cortado pelo SVG. */
async function semRotulosCortados(page: Page): Promise<void> {
  const cortados = await page.$$eval(
    ".recharts-cartesian-axis-tick-value",
    (els) =>
      els
        .map((e) => {
          const el = e as SVGTextElement;
          const box = el.getBoundingClientRect();
          const svg = el.closest("svg")?.getBoundingClientRect();
          return {
            texto: el.textContent,
            left: box.left,
            right: box.right,
            svgLeft: svg?.left ?? 0,
            svgRight: svg?.right ?? 0,
          };
        })
        .filter((t) => t.left < t.svgLeft - 2 || t.right > t.svgRight + 2),
  );
  expect(
    cortados,
    `rótulos de eixo cortados: ${JSON.stringify(cortados)}`,
  ).toEqual([]);
}

test.describe("páginas", () => {
  for (const p of PAGINAS) {
    test(`${p.name} (${p.path})`, async ({ page }, testInfo) => {
      const erros = monitorar(page, { permitir404: p.permitir404 });

      await page.goto(p.path, { waitUntil: "domcontentloaded" });

      if (p.heading) {
        await expect(
          page.getByRole("heading", { name: p.heading }).first(),
        ).toBeVisible();
      }
      if (p.texto) {
        await expect(page.getByText(p.texto).first()).toBeVisible();
      }
      if (p.progresso) {
        await expect(page.getByRole("progressbar").first()).toBeVisible();
      }
      if (p.aoVivo) {
        // Só aparece "Ao vivo" quando a SSE conectou via proxy do Next.
        await expect(
          page.getByText("Ao vivo").filter({ visible: true }).first(),
        ).toBeVisible({ timeout: 20_000 });
      }
      if (p.tabela) {
        // Em telas pequenas a tabela dá lugar a uma lista, sem colunas cortadas.
        const tabela = page.getByTestId("candidatos-tabela");
        const lista = page.getByTestId("candidatos-lista");
        if (testInfo.project.name === "desktop") {
          await expect(tabela).toBeVisible();
          await expect(lista).toBeHidden();
        } else {
          await expect(lista).toBeVisible();
          await expect(tabela).toBeHidden();
        }
      }

      // Deixa gráficos (Recharts) e transições assentarem antes da captura.
      await page.waitForTimeout(800);

      await semOverflowHorizontal(page);
      await semRotulosCortados(page);

      // Congela animações para uma imagem estável.
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important}",
      });

      const dir = `e2e/screenshots/${testInfo.project.name}`;
      mkdirSync(dir, { recursive: true });
      await page.screenshot({
        path: `${dir}/${p.name}.png`,
        fullPage: true,
      });

      expect(erros, erros.join("\n")).toEqual([]);
    });
  }
});

test.describe("2º turno presidencial", () => {
  test("primeira seção mostra só os dois candidatos, sem painel personalizado", async ({
    page,
  }, testInfo) => {
    const erros = monitorar(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // A seção de destaque é a primeira do conteúdo e traz exatamente 2 cartões.
    // (O streaming do Next mantém a versão do servidor oculta por alguns ms.)
    const heroes = page.getByTestId("presidente-segundo-turno");
    await expect(heroes).toHaveCount(1, { timeout: 20_000 });
    const hero = heroes.first();
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("data-turno", "2");
    await expect(hero.getByTestId("candidato-destaque")).toHaveCount(2, {
      timeout: 20_000,
    });
    await expect(hero.getByRole("heading", { name: "LULA" })).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: "FLAVIO BOLSONARO" }),
    ).toBeVisible();

    // Fotos oficiais do TSE (por `sqcand`) carregaram de verdade.
    const fotos = hero.getByTestId("foto-candidato");
    await expect(fotos).toHaveCount(2);
    for (const foto of await fotos.all()) {
      await expect
        .poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }

    // Os dois classificados aparecem na primeira seção e em nenhuma outra.
    await expect(page.getByTestId("candidato-destaque")).toHaveCount(2);

    // O filtro de acompanhamento foi retirado do painel.
    await expect(page.getByText("Painel personalizado")).toHaveCount(0);
    await expect(page.getByTestId("race-mini-card")).toHaveCount(0);

    await page.waitForTimeout(800);
    await semOverflowHorizontal(page);
    await semRotulosCortados(page);
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important}",
    });
    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/segundo-turno.png`, fullPage: true });

    expect(erros, erros.join("\n")).toEqual([]);
  });
});

test.describe("interações", () => {
  test("troca de cargo na UF (SP)", async ({ page }, testInfo) => {
    const erros = monitorar(page);

    await page.goto("/uf/sp", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Ao vivo").filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Senador" }).click();
    await expect(page).toHaveURL(/cargo=5/);
    await expect(
      page.getByRole("heading", { name: "Senador" }).first(),
    ).toBeVisible();

    await page.waitForTimeout(500);
    await semOverflowHorizontal(page);

    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/uf-sp-senador.png`, fullPage: true });

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("página do Presidente mantém o 2º turno em evidência", async ({ page }) => {
    const erros = monitorar(page);

    await page.goto("/presidente", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Ao vivo").filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const heroes = page.getByTestId("presidente-segundo-turno");
    await expect(heroes).toHaveCount(1, { timeout: 20_000 });
    const hero = heroes.first();
    await expect(hero).toHaveAttribute("data-turno", "2");
    await expect(hero.getByTestId("candidato-destaque")).toHaveCount(2, {
      timeout: 20_000,
    });
    await expect(page.getByRole("progressbar").first()).toBeVisible();

    // Evolução por candidato, recortando o início vazio e o fim repetido.
    await expect(page.getByText("LULA (PT)")).toBeVisible();
    await expect(page.getByText("FLAVIO BOLSONARO (PL)")).toBeVisible();
    await expect(page.locator(".recharts-line")).toHaveCount(2);
    await expect(page.getByText(/amostras úteis de 10/)).toBeVisible();

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("destaca os dois candidatos do 2º turno (Governador SP)", async ({ page }, testInfo) => {
    const erros = monitorar(page);

    await page.goto("/uf/sp", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Ao vivo").filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // No cenário do mock o Governador já está no 2º turno: aparece a faixa
    // oficial e os dois candidatos ficam realçados.
    await expect(page.getByTestId("segundo-turno")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("segundo-turno")).toHaveAttribute(
      "data-origem",
      "oficial",
    );
    // Os dois classificados ficam realçados; o selo é só da faixa da seção.
    await expect(
      page.locator('[data-testid="candidate-bar"][data-segundo-turno]'),
    ).toHaveCount(2);

    await semOverflowHorizontal(page);

    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/uf-sp-segundo-turno.png`, fullPage: true });

    expect(erros, erros.join("\n")).toEqual([]);
  });
});
