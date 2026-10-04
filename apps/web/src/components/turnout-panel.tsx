import type { RaceResult } from "@apuracao/domain";
import { Card, Progress, Stat } from "@/components/ui";
import { formatInt, formatPercent } from "@/lib/format";

export function TurnoutPanel({ race }: { race: RaceResult }) {
  const { secoes, eleitorado, votos } = race;
  const abstencoes = eleitorado.abstencoes;
  const pctAbstencao =
    eleitorado.total > 0 ? (abstencoes / eleitorado.total) * 100 : 0;

  return (
    <Card className="min-w-0 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Apuração
        </h3>
        <span className="tabular text-sm font-semibold">
          {formatPercent(secoes.percentualTotalizadas)}
        </span>
      </div>

      <Progress value={secoes.percentualTotalizadas} className="mb-1" />
      <div className="mb-4 text-xs text-muted-foreground">
        {formatInt(secoes.totalizadas)} de {formatInt(secoes.total)} seções totalizadas
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Comparecimento"
          value={formatPercent(eleitorado.percentualComparecimento)}
          hint={formatInt(eleitorado.comparecimento)}
        />
        <Stat
          label="Abstenção"
          value={formatPercent(pctAbstencao)}
          hint={formatInt(abstencoes)}
        />
        <Stat label="Votos válidos" value={formatInt(votos.validos)} />
        <Stat label="Eleitorado apto" value={formatInt(eleitorado.total)} />
        <Stat label="Brancos" value={formatInt(votos.brancos)} />
        <Stat label="Nulos" value={formatInt(votos.nulos)} />
      </div>
    </Card>
  );
}
