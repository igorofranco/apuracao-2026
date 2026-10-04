"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useRouter } from "next/navigation";
import { UFS, getUf } from "@apuracao/shared";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

export interface MapaDado {
  uf: string;
  percentual: number;
  lider?: {
    nomeUrna: string;
    siglaPartido: string;
    votos: number;
    percentual: number;
  } | null;
}

type Modo = "apuracao" | "lideranca";

interface Feature {
  type: "Feature";
  properties: { codarea: string };
  geometry: GeoPermissibleObjects;
}
interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

const VIEW = 760;

/** Código IBGE -> sigla da UF (para casar as features do GeoJSON). */
const UF_POR_IBGE = new Map(UFS.map((u) => [u.codigoIbge, u.uf]));

function corApuracao(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  // de cinza-azulado para verde.
  const from = [226, 230, 238];
  const to = [34, 201, 138];
  const c = from.map((f, i) => Math.round(f + (to[i]! - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function corPartido(sigla: string): string {
  let h = 0;
  for (let i = 0; i < sigla.length; i++) h = (h * 31 + sigla.charCodeAt(i)) % 360;
  return `hsl(${h}, 62%, 52%)`;
}

export function BrazilMap({
  dados,
  modo = "lideranca",
  className,
}: {
  dados: MapaDado[];
  modo?: Modo;
  className?: string;
}) {
  const router = useRouter();
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; dado: MapaDado } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/geo/brasil-ufs.json")
      .then((r) => r.json())
      .then((json: FeatureCollection) => {
        if (active) setGeo(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const porUf = useMemo(() => {
    const m = new Map<string, MapaDado>();
    for (const d of dados) m.set(d.uf.toLowerCase(), d);
    return m;
  }, [dados]);

  const paths = useMemo(() => {
    if (!geo) return [];
    const projection = geoMercator().fitSize([VIEW, VIEW], geo as unknown as GeoPermissibleObjects);
    const path = geoPath(projection);
    return geo.features.map((f) => {
      const uf = UF_POR_IBGE.get(Number(f.properties.codarea)) ?? "";
      return { uf, d: path(f as unknown as GeoPermissibleObjects) ?? "" };
    });
  }, [geo]);

  const cor = (d: MapaDado | undefined): string => {
    if (!d) return "var(--muted)";
    if (modo === "apuracao") return corApuracao(d.percentual);
    if (d.lider?.siglaPartido) return corPartido(d.lider.siglaPartido);
    return "var(--muted)";
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative aspect-square w-full", className)}
    >
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="block h-auto w-full"
        role="group"
        aria-label="Mapa do Brasil por unidade da federação"
      >
        {paths.map(({ uf, d }) => {
          const dado = porUf.get(uf);
          const nome = getUf(uf)?.nome ?? uf.toUpperCase();
          if (!uf) {
            return (
              <path
                key={d.slice(0, 12)}
                d={d}
                fill="var(--muted)"
                stroke="var(--background)"
                strokeWidth={0.8}
              />
            );
          }
          return (
            <a
              key={uf}
              href={`/uf/${uf}`}
              aria-label={`Ver apuração de ${nome}`}
              className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={(e) => {
                // Intercepta só o clique simples; preserva abrir em nova aba etc.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                router.push(`/uf/${uf}`);
              }}
              onMouseMove={(e) => {
                if (!dado) return;
                const rect = containerRef.current?.getBoundingClientRect();
                setHover({
                  x: e.clientX - (rect?.left ?? 0),
                  y: e.clientY - (rect?.top ?? 0),
                  dado,
                });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <path
                d={d}
                fill={cor(dado)}
                stroke="var(--background)"
                strokeWidth={0.8}
                className="transition-opacity hover:opacity-80"
              />
            </a>
          );
        })}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card p-2 text-xs shadow-lg"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="font-semibold">{getUf(hover.dado.uf)?.nome ?? hover.dado.uf}</div>
          <div className="text-muted-foreground">
            {formatPercent(hover.dado.percentual)} apurado
          </div>
          {hover.dado.lider ? (
            <div className="mt-1 flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: corPartido(hover.dado.lider.siglaPartido) }}
              />
              <span className="truncate">
                {hover.dado.lider.nomeUrna} ({hover.dado.lider.siglaPartido})
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
