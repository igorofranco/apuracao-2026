/**
 * Gera `public/geo/municipios-brasil.json`: as malhas municipais de todas as
 * UFs já projetadas no mesmo viewBox do mapa do Brasil.
 *
 * Por que pré-projetar: o mapa do Brasil desenha ~5.500 municípios de uma vez.
 * Fazer a projeção d3 no browser custaria CPU em cada visita; aqui o custo é
 * pago uma vez e o cliente só concatena os caminhos por cor.
 *
 * Uso: npm run geo:brasil -w @apuracao/web
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { geoMercator, geoPath } from "d3-geo";

/** Deve casar com MAPA_VIEW em src/lib/geo.ts. */
const VIEW = 760;
const GEO_DIR = new URL("../public/geo/", import.meta.url);
const MUNICIPIOS_DIR = new URL("municipios/", GEO_DIR);
const SAIDA = new URL("municipios-brasil.json", GEO_DIR);

const brasil = JSON.parse(
  readFileSync(new URL("brasil-ufs.json", GEO_DIR), "utf8"),
);
const projection = geoMercator().fitSize([VIEW, VIEW], brasil);
const path = geoPath(projection).digits(1);

const municipios = [];
for (const arquivo of readdirSync(MUNICIPIOS_DIR).sort()) {
  if (!arquivo.endsWith(".json")) continue;
  const uf = arquivo.slice(0, -5);
  const json = JSON.parse(
    readFileSync(new URL(arquivo, MUNICIPIOS_DIR), "utf8"),
  );
  for (const feature of json.features) {
    const id = feature?.properties?.id;
    if (!id) continue;
    municipios.push([String(id), uf, path(feature) ?? ""]);
  }
}

municipios.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const json = JSON.stringify({ view: VIEW, municipios });
writeFileSync(SAIDA, json);

console.log(
  `[geo] ${municipios.length} municípios, ${(json.length / 1e6).toFixed(2)} MB ` +
    `(${(gzipSync(json).length / 1024).toFixed(0)} KB gzip) -> ${SAIDA.pathname}`,
);
