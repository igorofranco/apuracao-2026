"use client";

import { corPartido, nomePartido } from "@/lib/partidos";
import { corApuracao } from "@/lib/mapa";
import { formatPercent } from "@/lib/format";

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

/**
 * Legenda do mapa de apuração: rampa de cor do menos ao mais apurado.
 * No modo absoluto o topo é sempre 100%; no relativo, o estado mais apurado.
 */
export function ApuracaoMapLegend({
  escala,
  maxPercentual,
}: {
  escala: "absoluto" | "relativo";
  maxPercentual: number;
}) {
  const fim = escala === "absoluto" ? "100%" : formatPercent(maxPercentual, 0);
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Legenda · {escala === "absoluto" ? "escala absoluta" : "escala relativa"}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular">0%</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${corApuracao(0)}, ${corApuracao(100)})`,
          }}
          aria-hidden
        />
        <span className="tabular">{fim}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {escala === "absoluto"
          ? "Cor proporcional ao percentual de urnas apuradas (0–100%)."
          : "Cor proporcional ao estado mais apurado."}
      </p>
    </div>
  );
}
