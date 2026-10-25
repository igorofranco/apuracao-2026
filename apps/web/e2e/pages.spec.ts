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
    name: "nao-encontrado",
    path: "/rota-que-nao-existe",
    heading: /Página não encontrada/,
    aoVivo: false,
    permitir404: true,
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

/**
 * Espera a versão visível do mapa. O streaming do Next mantém por alguns ms
 * uma cópia oculta do HTML do servidor; sem isso o locator fica ambíguo.
 */
async function abrirMapaPresidente(page: Page) {
  const mapas = page.getByTestId("mapa-presidente");
  await expect(mapas).toHaveCount(1, { timeout: 20_000 });
  const mapa = mapas.first();
  await expect(mapa).toBeVisible();
  return mapa;
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
    const requisicoes: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/resultado")) requisicoes.push(req.url());
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // A seção de destaque é a primeira do conteúdo e traz exatamente 2 cartões.
    // (O streaming do Next mantém a versão do servidor oculta por alguns ms.)
    const heroes = page.getByTestId("presidente-segundo-turno");
    await expect(heroes).toHaveCount(1, { timeout: 20_000 });
    const hero = heroes.first();
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("data-turno", "2");
    const cartoes = hero.getByTestId("candidato-destaque");
    await expect(cartoes).toHaveCount(2, { timeout: 20_000 });
    await expect(hero.getByRole("heading", { name: "LULA" })).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: "FLAVIO BOLSONARO" }),
    ).toBeVisible();

    // Sem apuração do 2º turno: os dois aparecem zerados, sem "1º lugar".
    await expect(cartoes.getByText("0,0%")).toHaveCount(2);
    await expect(cartoes.getByText("0", { exact: true })).toHaveCount(2);
    await expect(hero.getByText("1º lugar")).toHaveCount(0);

    // A Presidência não consulta mais a eleição do 1º turno (6257).
    expect(
      requisicoes.some((url) => /eleicao=6257/.test(url) && /cargo=1/.test(url)),
    ).toBe(false);
    expect(
      requisicoes.some((url) => /eleicao=6258/.test(url) && /cargo=1/.test(url)),
    ).toBe(true);

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

  test("mostra fotos e nomes da dupla antes de o TSE publicar a corrida", async ({
    page,
    context,
  }, testInfo) => {
    const erros = monitorar(page, { permitir404: true });
    // Simula o painel antes de o collector ter a corrida 6258: /api/resultado
    // responde 404 para o Brasil.
    await context.addCookies([
      { name: "mock_sem_resultado", value: "1", url: "http://localhost:3000" },
    ]);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const heroes = page.getByTestId("presidente-segundo-turno");
    await expect(heroes).toHaveCount(1, { timeout: 20_000 });
    const hero = heroes.first();
    const cartoes = hero.getByTestId("candidato-destaque");
    await expect(cartoes).toHaveCount(2);

    // Identificação completa, mesmo sem votos.
    await expect(hero.getByRole("heading", { name: "LULA" })).toBeVisible();
    await expect(
      hero.getByRole("heading", { name: "FLAVIO BOLSONARO" }),
    ).toBeVisible();
    await expect(hero.getByText("Luiz Inácio Lula da Silva")).toBeVisible();
    await expect(hero.getByText("Flavio Nantes Bolsonaro")).toBeVisible();
    await expect(
      hero.getByText("Aguardando o início da apuração do 2º turno"),
    ).toBeVisible();

    // Sem inventar apuração: 0,0% / 0 voto e sem "1º lugar".
    await expect(cartoes.getByText("0,0%")).toHaveCount(2);
    await expect(cartoes.getByText("0", { exact: true })).toHaveCount(2);
    await expect(hero.getByText("1º lugar")).toHaveCount(0);

    // Fotos oficiais do TSE (por `sqcand`) carregaram de verdade.
    const fotos = hero.getByTestId("foto-candidato");
    await expect(fotos).toHaveCount(2);
    for (const foto of await fotos.all()) {
      await expect
        .poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    }

    // O mapa logo abaixo também aparece no estado de espera.
    await abrirMapaPresidente(page);
    await expect(page.getByTestId("mapa-presidente-vazio")).toBeVisible();

    await page.waitForTimeout(500);
    await semOverflowHorizontal(page);
    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/segundo-turno-sem-corrida.png`,
      fullPage: true,
    });

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("mapa por estado fica neutro até haver votos no 2º turno", async ({ page }) => {
    const erros = monitorar(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapa = await abrirMapaPresidente(page);
    await expect(
      mapa.getByRole("heading", { name: "Mapa do 2º turno" }),
    ).toBeVisible();

    // O mapa divide a tela com o destaque dos presidentes: ao lado em
    // paisagem, logo abaixo em retrato.
    const hero = page.getByTestId("presidente-segundo-turno").first();
    const heroBox = await hero.boundingBox();
    const mapaBox = await mapa.boundingBox();
    const viewport = page.viewportSize()!;
    if (viewport.width > viewport.height) {
      expect(mapaBox!.x).toBeGreaterThanOrEqual(
        heroBox!.x + heroBox!.width - 1,
      );
    } else {
      expect(mapaBox!.y).toBeGreaterThanOrEqual(
        heroBox!.y + heroBox!.height - 1,
      );
    }

    // Sem votos: mapa neutro + aviso de espera, sem inventar percentuais.
    await expect(mapa.getByTestId("mapa-presidente-vazio")).toBeVisible();
    const spPath = mapa.getByTestId("mapa-estado-base-sp");
    await expect(spPath).toHaveAttribute("fill", "#e4e9f2");
    // Divisas entre UFs finas, para não competir com as cores do heatmap.
    await expect(spPath).toHaveAttribute("stroke-width", "0.8");

    // A malha municipal do Brasil é carregada, mas sem votos não pinta nada.
    const camadaBrasil = mapa.getByTestId("mapa-municipios-brasil");
    await expect(camadaBrasil).toHaveAttribute("data-municipios", "0");
    await expect(camadaBrasil).toHaveAttribute("pointer-events", "none");

    // Relativo é o padrão; o switch alterna para absoluto.
    const relativo = mapa.getByRole("button", { name: "Relativo" });
    const absoluto = mapa.getByRole("button", { name: "Absoluto" });
    await expect(mapa).toHaveAttribute("data-escala", "relativo");
    await expect(relativo).toHaveAttribute("aria-pressed", "true");
    await expect(absoluto).toHaveAttribute("aria-pressed", "false");
    await absoluto.click();
    await expect(absoluto).toHaveAttribute("aria-pressed", "true");
    await expect(mapa).toHaveAttribute("data-escala", "absoluto");

    // Cores: com neutro (padrão) ou direto entre as duas cores.
    const comNeutro = mapa.getByRole("button", { name: "Com neutro" });
    const semNeutro = mapa.getByRole("button", { name: "Sem neutro" });
    await expect(mapa).toHaveAttribute("data-modo-cores", "neutro");
    await expect(comNeutro).toHaveAttribute("aria-pressed", "true");
    await semNeutro.click();
    await expect(mapa).toHaveAttribute("data-modo-cores", "direto");
    await expect(semNeutro).toHaveAttribute("aria-pressed", "true");

    // A legenda identifica as duas pontas do gradiente.
    const legenda = mapa.getByTestId("mapa-presidente-legenda");
    await expect(legenda.getByText("LULA")).toBeVisible();
    await expect(legenda.getByText("FLAVIO BOLSONARO")).toBeVisible();

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("alterna entre mapa e gráfico no mesmo card", async ({
    page,
    context,
  }, testInfo) => {
    const erros = monitorar(page);
    const pedidosGrafico: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/grafico")) pedidosGrafico.push(req.url());
    });
    // Votação simulada para o gráfico ter duas linhas com variação.
    await context.addCookies([
      { name: "mock_municipios", value: "1", url: "http://localhost:3000" },
    ]);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // O gráfico é buscado já na carga, junto com a apuração, mesmo com o mapa
    // como visão padrão (sem esperar o usuário trocar o switch).
    await expect
      .poll(() => pedidosGrafico.length, { timeout: 20_000 })
      .toBeGreaterThan(0);
    expect(pedidosGrafico[0]).toContain(
      "/api/grafico?eleicao=6258&cargo=1&uf=br",
    );

    const mapa = await abrirMapaPresidente(page);
    const botaoMapa = mapa.getByRole("button", { name: "Mapa" });
    const botaoGrafico = mapa.getByRole("button", { name: "Gráfico" });

    // O mapa é a visão prioritária (padrão).
    await expect(mapa).toHaveAttribute("data-visao", "mapa");
    await expect(botaoMapa).toHaveAttribute("aria-pressed", "true");
    await expect(botaoGrafico).toHaveAttribute("aria-pressed", "false");
    await expect(mapa.getByTestId("mapa-estados")).toBeVisible();

    await botaoGrafico.click();
    await expect(mapa).toHaveAttribute("data-visao", "grafico");
    await expect(botaoGrafico).toHaveAttribute("aria-pressed", "true");
    await expect(
      mapa.getByRole("heading", { name: "Evolução da apuração" }),
    ).toBeVisible();
    await expect(mapa.getByTestId("mapa-estados")).toHaveCount(0);
    await expect(mapa.getByTestId("mapa-presidente-legenda")).toHaveCount(0);

    // Duas linhas, uma por candidato, com os percentuais do último ponto.
    const grafico = mapa.getByTestId("grafico-evolucao");
    await expect(grafico).toHaveAttribute("data-estado", "pronto", {
      timeout: 20_000,
    });
    await expect(grafico.locator(".recharts-line-curve")).toHaveCount(2, {
      timeout: 20_000,
    });
    await expect(grafico.getByText("LULA")).toBeVisible();
    await expect(grafico.getByText("FLAVIO BOLSONARO")).toBeVisible();
    await expect(grafico.getByText("51,3%")).toBeVisible();
    await expect(grafico.getByText("48,7%")).toBeVisible();

    // O gráfico também tem o switch de escala. No relativo, o domínio é o
    // mínimo/máximo dos dados (não 0–100).
    const relativo = mapa.getByRole("button", { name: "Relativo" });
    const absoluto = mapa.getByRole("button", { name: "Absoluto" });
    await expect(relativo).toBeVisible();
    await expect(absoluto).toBeVisible();
    await expect(relativo).toHaveAttribute("aria-pressed", "true");
    await expect(grafico).toHaveAttribute("data-escala", "relativo");
    const dominioRelativo = (await grafico.getAttribute("data-dominio"))!;
    const [minRelativo, maxRelativo] = dominioRelativo.split(":").map(Number);
    expect(minRelativo).toBeGreaterThan(0);
    expect(maxRelativo).toBeLessThan(100);

    await semOverflowHorizontal(page);
    await semRotulosCortados(page);
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important}",
    });
    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/grafico-evolucao.png`, fullPage: true });

    // Absoluto: eixo fixo em 0–100%.
    await absoluto.click();
    await expect(absoluto).toHaveAttribute("aria-pressed", "true");
    await expect(grafico).toHaveAttribute("data-escala", "absoluto");
    await expect(grafico).toHaveAttribute("data-dominio", "0:100");
    await expect(grafico.getByText("0%", { exact: true })).toBeVisible();
    await expect(grafico.getByText("100%", { exact: true })).toBeVisible();
    await semRotulosCortados(page);
    await page.screenshot({
      path: `${dir}/grafico-evolucao-absoluto.png`,
      fullPage: true,
    });

    await relativo.click();
    await expect(relativo).toHaveAttribute("aria-pressed", "true");
    await expect(grafico).toHaveAttribute("data-escala", "relativo");

    // Volta ao mapa, preservando o card.
    await botaoMapa.click();
    await expect(mapa).toHaveAttribute("data-visao", "mapa");
    await expect(mapa.getByTestId("mapa-estados")).toBeVisible();
    await expect(botaoMapa).toHaveAttribute("aria-pressed", "true");

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("abre os municípios de um estado no mesmo mapa", async ({
    page,
  }, testInfo) => {
    const erros = monitorar(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapa = await abrirMapaPresidente(page);
    await expect(mapa.getByTestId("mapa-presidente-vazio")).toBeVisible();

    // Clique no estado abre o drill-down municipal no mesmo card.
    await mapa.getByTestId("mapa-estado-sp").click();
    await expect(mapa).toHaveAttribute("data-uf", "sp");
    await expect(mapa.getByTestId("mapa-municipios")).toBeVisible();
    await expect(mapa.getByRole("button", { name: "Brasil" })).toBeVisible();
    await expect(mapa.getByText(/município de São Paulo/)).toBeVisible();

    // Malha municipal de SP: 645 municípios desenhados.
    const municipios = mapa.locator('[data-testid^="mapa-municipio-"]');
    await expect(municipios).toHaveCount(645);

    // Sem divisas internas: o traço de cada município é a própria cor do fill.
    const primeiro = municipios.first().locator("path");
    const fill = await primeiro.getAttribute("fill");
    expect(fill).toBeTruthy();
    await expect(primeiro).toHaveAttribute("stroke", fill!);

    // A única linha é o contorno da UF, mais grosso.
    const contorno = mapa.getByTestId("mapa-uf-contorno");
    await expect(contorno).toBeVisible();
    expect(Number(await contorno.getAttribute("stroke-width"))).toBeGreaterThan(
      2,
    );

    await mapa.scrollIntoViewIfNeeded();
    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/mapa-municipios-sp.png`,
      fullPage: true,
    });

    // Volta ao mapa do Brasil.
    await mapa.getByRole("button", { name: "Brasil" }).click();
    await expect(mapa).toHaveAttribute("data-uf", "");
    await expect(mapa.getByTestId("mapa-presidente-vazio")).toBeVisible();

    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("busca um município, abre a UF e mostra os dados", async ({
    page,
    context,
  }) => {
    const erros = monitorar(page);
    const assets: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("municipios-brasil")) assets.push(req.url());
    });
    await context.addCookies([
      { name: "mock_municipios", value: "1", url: "http://localhost:3000" },
    ]);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapa = await abrirMapaPresidente(page);
    const busca = mapa.getByRole("combobox", { name: "Buscar município" });
    await expect(busca).toBeEnabled({ timeout: 20_000 });

    // O asset municipal é versionado na URL para furar o cache longo de public/.
    expect(
      assets.some((url) => /municipios-brasil\.json\?v=\d+/.test(url)),
    ).toBe(true);

    await busca.fill("são paulo");
    await mapa
      .getByRole("option", { name: "São Paulo (SP)", exact: true })
      .click();

    // Abre a UF do município e destaca o polígono selecionado.
    await expect(mapa).toHaveAttribute("data-uf", "sp");
    await expect(mapa.getByTestId("mapa-municipio-selecionado")).toBeVisible();

    // O nome completo do município fica no input, com o botão de limpar.
    await expect(busca).toHaveValue("São Paulo");
    const limpar = mapa.getByRole("button", {
      name: "Limpar busca de município",
    });
    await expect(limpar).toBeVisible();

    // Painel (sidebar no desktop, resumo acima do mapa no mobile) mostra os votos.
    const painel = page
      .getByTestId(/^municipio-selecionado/)
      .filter({ visible: true })
      .first();
    await expect(painel).toContainText("São Paulo");
    await expect(painel).toContainText("LULA");
    await expect(painel).toContainText("FLAVIO BOLSONARO");

    // Clicar em outro município do mapa troca a seleção (e o nome no input).
    await mapa.getByTestId("mapa-municipio-3509502").click();
    await expect(
      page.getByTestId(/^municipio-selecionado/).filter({ visible: true }).first(),
    ).toContainText("Campinas");
    await expect(busca).toHaveValue("Campinas");

    // Limpar a busca também remove a seleção, sem sair da UF.
    await limpar.click();
    await expect(busca).toHaveValue("");
    await expect(page.getByTestId(/^municipio-selecionado/)).toHaveCount(0);
    await expect(mapa).toHaveAttribute("data-uf", "sp");

    // Voltar ao Brasil limpa tudo.
    await mapa.getByRole("button", { name: "Brasil" }).click();
    await expect(mapa).toHaveAttribute("data-uf", "");
    await expect(busca).toHaveValue("");

    await semOverflowHorizontal(page);
    expect(erros, erros.join("\n")).toEqual([]);
  });

  test("dica de busca curta não desloca o mapa", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapa = await abrirMapaPresidente(page);
    const busca = mapa.getByRole("combobox", { name: "Buscar município" });
    await expect(busca).toBeEnabled({ timeout: 20_000 });
    const svg = mapa.getByTestId("mapa-estados");
    await expect(svg).toBeVisible({ timeout: 20_000 });

    // Posição no documento (imune ao scroll que o foco no input provoca).
    const topoMapa = async () => {
      const box = await svg.boundingBox();
      const scroll = await page.evaluate(() => window.scrollY);
      return box!.y + scroll;
    };
    const antes = await topoMapa();

    // Com 1 letra aparece a dica, mas ela flutua (não empurra o mapa).
    await busca.fill("s");
    await expect(mapa.getByText("Digite ao menos 2 letras.")).toBeVisible();
    expect(await topoMapa()).toBeCloseTo(antes, 0);

    // A lista de resultados também é flutuante.
    await busca.fill("campinas");
    await expect(mapa.getByRole("option").first()).toBeVisible();
    expect(await topoMapa()).toBeCloseTo(antes, 0);
  });

  test("visão Brasil mostra os municípios sem interação e mantém o clique no estado", async ({
    page,
    context,
  }, testInfo) => {
    const erros = monitorar(page);
    // Liga a votação simulada só para esta página, sem afetar os demais testes.
    await context.addCookies([
      { name: "mock_municipios", value: "1", url: "http://localhost:3000" },
    ]);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const mapa = await abrirMapaPresidente(page);

    // A camada municipal do Brasil carrega e pinta milhares de municípios.
    const camada = mapa.getByTestId("mapa-municipios-brasil");
    await expect(camada).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(
        async () => Number(await camada.getAttribute("data-municipios")),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(5_000);
    // Sem hover/clique e sem elementos individuais por município.
    await expect(camada).toHaveAttribute("pointer-events", "none");
    await expect(camada).toHaveAttribute("aria-hidden", "true");
    await expect(mapa.locator('[data-testid^="mapa-municipio-"]')).toHaveCount(
      0,
    );

    await mapa.scrollIntoViewIfNeeded();
    const dir = `e2e/screenshots/${testInfo.project.name}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: `${dir}/mapa-municipios-brasil.png`,
      fullPage: true,
    });

    // O estado continua com hover e clique.
    await mapa.getByTestId("mapa-estado-sp").hover();
    await expect(mapa.getByText("São Paulo")).toBeVisible();
    await expect(mapa.getByText("Clique para abrir a UF")).toBeVisible();

    await mapa.getByTestId("mapa-estado-sp").click();
    await expect(mapa).toHaveAttribute("data-uf", "sp");
    await expect(mapa.getByTestId("mapa-municipios")).toBeVisible();
    await expect(
      mapa.locator('[data-testid^="mapa-municipio-"]'),
    ).toHaveCount(645);

    // Volta ao Brasil: a camada municipal reaparece e não há aviso de vazio.
    await mapa.getByRole("button", { name: "Brasil" }).click();
    await expect(mapa).toHaveAttribute("data-uf", "");
    await expect(mapa.getByTestId("mapa-municipios-brasil")).toBeVisible();
    await expect(mapa.getByTestId("mapa-presidente-vazio")).toHaveCount(0);

    expect(erros, erros.join("\n")).toEqual([]);
  });
});

test.describe("tema", () => {
  // Simula um sistema operacional em modo escuro.
  test.use({ colorScheme: "dark" });

  test("segue o sistema, sem botão e sem localStorage", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // O CSS resolve o tema antes do primeiro paint, só com o media query.
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(
      page.getByRole("button", { name: "Alternar tema" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem("apuracao-theme")),
    ).toBeNull();
  });

  test("ignora preferência salva no localStorage", async ({ page, context }) => {
    await context.addInitScript(() =>
      localStorage.setItem("apuracao-theme", "light"),
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // O dispositivo manda: o valor antigo do localStorage não tem efeito.
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  });
});

test.describe("tema claro", () => {
  test.use({ colorScheme: "light" });

  test("segue o sistema claro", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  });
});

test.describe("escopo", () => {
  test("só tem a home: sem menu superior e sem as demais seções", async ({
    page,
  }) => {
    const erros = monitorar(page, { permitir404: true });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Menu superior removido por completo.
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("nav")).toHaveCount(0);

    // Apenas as duas seções permitidas.
    await expect(page.getByTestId("presidente-segundo-turno")).toBeVisible();
    await expect(page.getByTestId("mapa-presidente")).toBeVisible();
    await expect(page.getByText("Governadores por estado")).toHaveCount(0);
    await expect(page.getByText("Andamento por estado")).toHaveCount(0);
    await expect(page.getByText("Governador por estado")).toHaveCount(0);

    // Rotas antigas não existem mais.
    for (const rota of [
      "/presidente",
      "/uf/sp",
      "/uf/sp/71072",
      "/uf/sp/71072/zona/1",
    ]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), rota).toBe(404);
    }

    expect(erros, erros.join("\n")).toEqual([]);
  });
});

