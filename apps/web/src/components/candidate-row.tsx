import type { CandidateResult } from "@apuracao/domain";
import { Badge } from "@/components/ui";
import { MathBadge } from "@/components/math-badge";
import { cn } from "@/lib/utils";
import { formatInt, formatPercent } from "@/lib/format";

/**
 * Linha compacta de candidato no estilo da lista mobile (`CandidatesTable`):
 * número, nome + partido e votos/% empilhados à direita. Boa densidade em
 * espaços estreitos (ex.: os cards do "Meu painel"), inclusive no desktop.
 */
export function CandidateRow({
  candidato,
  destaque = false,
  className,
}: {
  candidato: CandidateResult;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <li
      data-testid="candidate-row"
      className={cn("flex min-w-0 items-center gap-3", className)}
    >
      <span
        className={cn(
          "tabular inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
          destaque ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {candidato.numero}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{candidato.nomeUrna}</span>
          {candidato.eleito ? <Badge variant="success">Eleito</Badge> : null}
          {candidato.matematicamenteEleito ? (
            <MathBadge className="shrink-0" />
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {candidato.siglaPartido}
          {candidato.situacao ? ` · ${candidato.situacao}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular text-sm font-semibold">{formatInt(candidato.votos)}</div>
        <div className="tabular text-xs text-muted-foreground">
          {formatPercent(candidato.percentual)}
        </div>
      </div>
    </li>
  );
}
