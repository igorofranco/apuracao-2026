"use client";

import { useState } from "react";
import type { CandidateResult } from "@apuracao/domain";
import { Badge, buttonClass, Card } from "@/components/ui";
import { MathBadge } from "@/components/math-badge";
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
  // Sem votos computados não há ranking; a coluna de posição é omitida e a
  // lista fica em ordem alfabética (ver normalizeCandidatos).
  const temVotos = candidatos.some((c) => c.votos > 0);

  return (
    <Card className="overflow-hidden">
      {/* Tabela: telas >= md */}
      <div data-testid="candidatos-tabela" className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {temVotos ? <th className="px-3 py-2 font-medium">#</th> : null}
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
                {temVotos ? (
                  <td className="tabular px-3 py-2 text-muted-foreground">{c.posicao}</td>
                ) : null}
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.eleito ? (
                      <Badge variant="success">Eleito</Badge>
                    ) : c.situacao ? (
                      <span className="text-xs text-muted-foreground">{c.situacao}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {c.matematicamenteEleito ? <MathBadge /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista: telas pequenas (< md) — evita espremer/cortar as colunas */}
      <ul data-testid="candidatos-lista" className="divide-y divide-border md:hidden">
        {visiveis.map((c) => (
          <li
            key={`${c.numero}-${c.sqcand ?? c.nome}`}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <span className="tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
              {c.numero}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{c.nomeUrna}</span>
                {c.eleito ? <Badge variant="success">Eleito</Badge> : null}
                {c.matematicamenteEleito ? <MathBadge className="shrink-0" /> : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {c.siglaPartido}
                {c.situacao ? ` · ${c.situacao}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular text-sm font-semibold">{formatInt(c.votos)}</div>
              <div className="tabular text-xs text-muted-foreground">
                {formatPercent(c.percentual)}
              </div>
            </div>
          </li>
        ))}
      </ul>

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
