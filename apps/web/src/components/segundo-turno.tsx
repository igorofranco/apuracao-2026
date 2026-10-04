import { Badge } from "@/components/ui";
import { NumeroBadge } from "@/components/numero-badge";
import type { OrigemSegundoTurno, SegundoTurno } from "@/lib/segundo-turno";

/**
 * Selo de 2º turno: `oficial` quando o TSE já marcou a situação do candidato;
 * `matematico` quando é projeção conservadora (o 3º colocado não alcança os dois
 * primeiros e o 1º não chega a 50%+1).
 */
export function SegundoTurnoBadge({
  origem,
  className,
}: {
  origem: OrigemSegundoTurno;
  className?: string;
}) {
  const oficial = origem === "oficial";
  return (
    <Badge
      variant="info"
      data-testid="badge-segundo-turno"
      data-origem={origem}
      title={
        oficial
          ? "2º turno confirmado pela totalização oficial do TSE"
          : "Matematicamente no 2º turno: o 3º colocado não alcança os dois primeiros e o 1º não obtém 50%+1"
      }
      className={className}
    >
      {oficial ? "2º turno" : "Matematicamente no 2º turno"}
    </Badge>
  );
}

/**
 * Faixa de destaque com os dois candidatos que disputam o 2º turno, usada no
 * topo do placar de Presidente/Governador.
 */
export function SegundoTurnoBanner({ disputa }: { disputa: SegundoTurno }) {
  const [a, b] = disputa.candidatos;
  if (!a || !b) return null;
  const oficial = disputa.origem === "oficial";
  return (
    <div
      data-testid="segundo-turno"
      data-origem={disputa.origem}
      className="rounded-xl border border-info/30 bg-info/5 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-info">
          {oficial ? "2º turno" : "2º turno matemático"}
        </span>
        <span className="text-xs text-muted-foreground">
          {oficial
            ? "Disputa confirmada pelo TSE"
            : "O 3º não alcança estes dois e o 1º não faz 50%+1"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <NumeroBadge
          numero={a.numero}
          destaque
          className="bg-info text-white dark:text-background"
        />
        <span className="font-semibold">{a.nomeUrna}</span>
        <span className="text-xs text-muted-foreground">{a.siglaPartido}</span>
        <span className="px-1 text-muted-foreground">×</span>
        <NumeroBadge
          numero={b.numero}
          destaque
          className="bg-info text-white dark:text-background"
        />
        <span className="font-semibold">{b.nomeUrna}</span>
        <span className="text-xs text-muted-foreground">{b.siglaPartido}</span>
      </div>
    </div>
  );
}
