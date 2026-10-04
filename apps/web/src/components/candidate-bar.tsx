import type { CandidateResult } from "@apuracao/domain";
import { NumeroBadge } from "@/components/numero-badge";
import { cn } from "@/lib/utils";
import { formatInt, formatPercent } from "@/lib/format";
import type { OrigemSegundoTurno } from "@/lib/segundo-turno";

export function CandidateBar({
  candidato,
  maxVotos,
  destaque = false,
  segundoTurno = null,
}: {
  candidato: CandidateResult;
  maxVotos: number;
  destaque?: boolean;
  /**
   * Presente quando o candidato disputa o 2º turno (oficial ou matemático).
   * Usado só para realçar a barra — o selo fica na faixa da seção.
   */
  segundoTurno?: OrigemSegundoTurno | null;
}) {
  const largura = maxVotos > 0 ? (candidato.votos / maxVotos) * 100 : 0;
  return (
    <div
      className={cn(
        "space-y-1",
        segundoTurno && "-mx-2 rounded-lg border border-info/30 bg-info/5 px-2 py-1.5",
      )}
      data-testid="candidate-bar"
      data-segundo-turno={segundoTurno ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <NumeroBadge numero={candidato.numero} destaque={destaque} />
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
          ) : candidato.matematicamenteEleito ? (
            <span
              data-testid="badge-matematicamente-eleito"
              title="Matematicamente eleito: não pode mais ser alcançado mesmo que todos os votos restantes sejam dos adversários"
              className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground dark:text-accent"
            >
              MATEMATICAMENTE ELEITO
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
