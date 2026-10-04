import Link from "next/link";
import type { RaceSummary } from "@apuracao/domain";
import { getCargo, getUf } from "@apuracao/shared";
import { Badge, Card, Progress } from "@/components/ui";
import { formatInt, formatPercent } from "@/lib/format";

function href(race: RaceSummary): string {
  if (race.uf === "br") return "/presidente";
  return `/uf/${race.uf}`;
}

export function RaceCard({ race }: { race: RaceSummary }) {
  const cargo = getCargo(race.cargo);
  const uf = race.uf === "br" ? null : getUf(race.uf);
  const titulo = cargo?.curto ?? `Cargo ${race.cargo}`;
  const local = uf?.nome ?? "Brasil";

  return (
    <Link href={href(race)} className="block focus-visible:outline-none">
      <Card className="h-full p-4 transition hover:border-primary/50 hover:shadow-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{titulo}</div>
            <div className="text-xs text-muted-foreground">{local}</div>
          </div>
          {race.totalizacaoFinal ? (
            <Badge variant="success">Finalizado</Badge>
          ) : (
            <Badge variant="muted">{formatPercent(race.percentualApurado, 1)}</Badge>
          )}
        </div>

        <Progress value={race.percentualApurado} className="mb-3" />

        {race.lider ? (
          <div className="flex items-center gap-2">
            <span className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {race.lider.numero}
            </span>
            <span className="truncate text-sm font-medium">{race.lider.nomeUrna}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {race.lider.partido}
            </span>
            <span className="tabular ml-auto shrink-0 text-sm font-semibold">
              {formatPercent(race.lider.percentual)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Aguardando início da apuração.
          </div>
        )}

        {race.lider ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {formatInt(race.lider.votos)} votos válidos
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
