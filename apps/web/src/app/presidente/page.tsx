"use client";

import { ELEICAO_2026, getCargo } from "@apuracao/shared";
import { useHistorico, useResultado } from "@/lib/queries";
import { LiveBadge } from "@/components/live-badge";
import { RaceBoard } from "@/components/race-board";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Badge, Card, Progress, Skeleton } from "@/components/ui";
import { formatDateTime, formatPercent } from "@/lib/format";

const PARAMS = { eleicao: ELEICAO_2026.eleicoes.federal, cargo: 1, uf: "br" };

export default function PresidentePage() {
  const race = useResultado(PARAMS);
  const historico = useHistorico(PARAMS);
  const cargo = getCargo(1);

  if (race.isError) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os dados do TSE agora. O coletor pode ainda estar
          iniciando — tente novamente em instantes.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Presidente</h1>
            {race.data?.totalizacaoFinal ? (
              <Badge variant="success">Totalização final</Badge>
            ) : (
              <Badge variant="muted">Em apuração</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Brasil · {formatDateTime(race.data?.atualizadoEm)}
          </p>
        </div>
        <LiveBadge />
      </section>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Seções totalizadas</span>
          <span className="tabular text-lg font-semibold">
            {formatPercent(race.data?.secoes.percentualTotalizadas ?? 0)}
          </span>
        </div>
        <Progress value={race.data?.secoes.percentualTotalizadas ?? 0} />
      </Card>

      {race.isLoading || !race.data ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <RaceBoard race={race.data} cargo={cargo!} maxBarras={12} />
          </div>
          <div className="min-w-0 space-y-4">
            <TurnoutPanel race={race.data} />
            {historico.data?.snapshots && historico.data.snapshots.length > 1 ? (
              <SnapshotTimeline snapshots={historico.data.snapshots} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
