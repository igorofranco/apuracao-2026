import type { CandidateResult } from "@apuracao/domain";
import { cn } from "@/lib/utils";
import { formatInt, formatPercent } from "@/lib/format";

export function CandidateBar({
  candidato,
  maxVotos,
  destaque = false,
}: {
  candidato: CandidateResult;
  maxVotos: number;
  destaque?: boolean;
}) {
  const largura = maxVotos > 0 ? (candidato.votos / maxVotos) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "tabular inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
              destaque ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {candidato.numero}
          </span>
          <span className="min-w-0 truncate text-sm font-medium">
            {candidato.nomeUrna}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {candidato.siglaPartido}
          </span>
          {candidato.eleito ? (
            <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              ELEITO
            </span>
          ) : null}
        </div>
        {/* Em telas pequenas os votos descem para uma segunda linha. */}
        <div className="tabular w-full shrink-0 text-right text-sm sm:w-auto">
          <span className="font-semibold">{formatInt(candidato.votos)}</span>
          <span className="ml-2 text-muted-foreground">
            {formatPercent(candidato.percentual)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            destaque ? "bg-primary" : "bg-primary/45",
          )}
          style={{ width: `${Math.max(largura, candidato.votos > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}
