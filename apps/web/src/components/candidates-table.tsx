"use client";

import { useState } from "react";
import type { CandidateResult } from "@apuracao/domain";
import { Badge, buttonClass, Card } from "@/components/ui";
import { formatInt, formatPercent } from "@/lib/format";

export function CandidatesTable({
  candidatos,
  limiteInicial = 25,
}: {
  candidatos: CandidateResult[];
  limiteInicial?: number;
}) {
  const [expandido, setExpandido] = useState(false);
  const limite = expandido ? candidatos.length : limiteInicial;
  const visiveis = candidatos.slice(0, limite);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Nº</th>
              <th className="px-3 py-2 font-medium">Candidato</th>
              <th className="px-3 py-2 font-medium">Partido</th>
              <th className="px-3 py-2 text-right font-medium">Votos</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr
                key={`${c.numero}-${c.sqcand ?? c.nome}`}
                className="border-b border-border/60 last:border-0 hover:bg-muted/40"
              >
                <td className="tabular px-3 py-2 text-muted-foreground">{c.posicao}</td>
                <td className="tabular px-3 py-2 font-semibold">{c.numero}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{c.nomeUrna}</div>
                  <div className="text-xs text-muted-foreground">{c.nome}</div>
                </td>
                <td className="px-3 py-2">{c.siglaPartido}</td>
                <td className="tabular px-3 py-2 text-right font-semibold">
                  {formatInt(c.votos)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {formatPercent(c.percentual)}
                </td>
                <td className="px-3 py-2">
                  {c.eleito ? (
                    <Badge variant="success">Eleito</Badge>
                  ) : c.situacao ? (
                    <span className="text-xs text-muted-foreground">{c.situacao}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {candidatos.length > limiteInicial ? (
        <div className="flex justify-center border-t border-border p-3">
          <button
            type="button"
            className={buttonClass("outline")}
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido
              ? "Mostrar menos"
              : `Mostrar todos (${formatInt(candidatos.length)})`}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
