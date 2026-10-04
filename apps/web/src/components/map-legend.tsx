"use client";

import { corPartido, nomePartido } from "@/lib/partidos";

/**
 * Legenda simplificada do mapa: lista apenas os partidos que de fato aparecem
 * como líderes no estado (evita uma legenda gigante com a lista inteira do TSE).
 */
export function MapLegend({ siglas }: { siglas: string[] }) {
  if (siglas.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Legenda · partido do líder
      </div>
      <ul
        className="flex flex-wrap gap-x-3 gap-y-1.5"
        aria-label="Partidos exibidos no mapa"
      >
        {siglas.map((sigla) => (
          <li key={sigla} className="inline-flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
              style={{ background: corPartido(sigla) }}
              aria-hidden
            />
            <span className="font-medium" title={nomePartido(sigla)}>
              {sigla}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
