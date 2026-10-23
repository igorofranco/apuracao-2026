"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { UFS, getUf } from "@apuracao/shared";

/** Lado do viewBox quadrado usado pelos mapas do Brasil. */
export const MAPA_VIEW = 760;

/** Margem (em unidades do viewBox) ao enquadrar os municípios de uma UF. */
const MAPA_MARGEM = 10;

interface Feature {
  type: "Feature";
  properties: { codarea: string };
  geometry: GeoPermissibleObjects;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

/** Código IBGE -> sigla da UF (para casar as features do GeoJSON). */
const UF_POR_IBGE = new Map(UFS.map((u) => [u.codigoIbge, u.uf]));

/** Cache do fetch: os dois mapas da home compartilham o mesmo GeoJSON. */
let geoCache: Promise<FeatureCollection> | null = null;

function carregarGeo(): Promise<FeatureCollection> {
  geoCache ??= fetch("/geo/brasil-ufs.json")
    .then((r) => r.json() as Promise<FeatureCollection>)
    .catch((err: unknown) => {
      // Permite tentar de novo no próximo componente que montar.
      geoCache = null;
      throw err;
    });
  return geoCache;
}

/**
 * Carrega o GeoJSON das UFs e projeta os caminhos do mapa. Compartilhado entre
 * os mapas (governadores, presidente) para não duplicar fetch/projeção.
 */
export function useBrasilGeo(): Array<{ uf: string; d: string }> {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let active = true;
    carregarGeo()
      .then((json) => {
        if (active) setGeo(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    if (!geo) return [];
    const projection = geoMercator().fitSize(
      [MAPA_VIEW, MAPA_VIEW],
      geo as unknown as GeoPermissibleObjects,
    );
    const path = geoPath(projection);
    return geo.features.map((f) => {
      const uf = UF_POR_IBGE.get(Number(f.properties.codarea)) ?? "";
      return { uf, d: path(f as unknown as GeoPermissibleObjects) ?? "" };
    });
  }, [geo]);
}

/* --------------------------- Malha municipal ---------------------------- */

interface MunicipioProperties {
  /** Código IBGE do município (casa com o `cdi` do TSE). */
  id: string;
  name: string;
}

interface MunicipioFeature {
  type: "Feature";
  properties: MunicipioProperties;
  geometry: GeoPermissibleObjects;
}

interface MunicipioCollection {
  type: "FeatureCollection";
  features: MunicipioFeature[];
}

const municipiosGeoCache = new Map<string, Promise<MunicipioCollection>>();

function carregarMunicipios(uf: string): Promise<MunicipioCollection> {
  const sigla = uf.toLowerCase();
  let promessa = municipiosGeoCache.get(sigla);
  if (!promessa) {
    promessa = fetch(`/geo/municipios/${sigla}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MunicipioCollection>;
      })
      .catch((err: unknown) => {
        municipiosGeoCache.delete(sigla);
        throw err;
      });
    municipiosGeoCache.set(sigla, promessa);
  }
  return promessa;
}

export interface MunicipioProjetado {
  /** Código IBGE (7 dígitos). */
  id: string;
  nome: string;
  /** Caminho SVG já projetado. */
  d: string;
}

/**
 * Carrega a malha municipal da UF (sob demanda) e projeta os caminhos. O
 * contorno da UF vem da mesma malha estadual usada no mapa do Brasil.
 */
export function useMunicipiosProjetados(uf: string | null): {
  paths: MunicipioProjetado[];
  contorno: string;
} {
  const [geo, setGeo] = useState<MunicipioCollection | null>(null);
  const [brasil, setBrasil] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    setGeo(null);
    if (!uf) return;
    let active = true;
    carregarMunicipios(uf)
      .then((json) => {
        if (active) setGeo(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [uf]);

  useEffect(() => {
    let active = true;
    carregarGeo()
      .then((json) => {
        if (active) setBrasil(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    if (!geo) return { paths: [], contorno: "" };
    const projection = geoMercator().fitExtent(
      [
        [MAPA_MARGEM, MAPA_MARGEM],
        [MAPA_VIEW - MAPA_MARGEM, MAPA_VIEW - MAPA_MARGEM],
      ],
      geo as unknown as GeoPermissibleObjects,
    );
    const path = geoPath(projection);
    const codigoIbge = uf ? getUf(uf)?.codigoIbge : undefined;
    const featureUf =
      codigoIbge != null
        ? brasil?.features.find(
            (f) => Number(f.properties.codarea) === codigoIbge,
          )
        : undefined;

    return {
      paths: geo.features.map((f) => ({
        id: String(f.properties.id),
        nome: f.properties.name,
        d: path(f as unknown as GeoPermissibleObjects) ?? "",
      })),
      contorno: featureUf
        ? (path(featureUf as unknown as GeoPermissibleObjects) ?? "")
        : "",
    };
  }, [geo, brasil, uf]);
}
