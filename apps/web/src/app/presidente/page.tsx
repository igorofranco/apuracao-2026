"use client";

import { ELEICAO_2026, getCargo } from "@apuracao/shared";
import { useHistorico, useResultado } from "@/lib/queries";
import { ErrorCard } from "@/components/error-card";
import { RaceDetail } from "@/components/race-detail";
import { RaceHeader } from "@/components/race-header";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TotalizadasCard } from "@/components/totalizadas-card";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Badge, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const PARAMS = { eleicao: ELEICAO_2026.eleicoes.federal, cargo: 1, uf: "br" };

export default function PresidentePage() {
  const race = useResultado(PARAMS);
  const historico = useHistorico(PARAMS);
  const cargo = getCargo(1);

  if (race.isError) {
    return (
      <ErrorCard>
        Não foi possível carregar os dados do TSE agora. O coletor pode ainda estar
        iniciando — tente novamente em instantes.
      </ErrorCard>
    );
  }

  return (
    <div className="space-y-6">
      <RaceHeader
        title="Presidente"
        badge={
          race.data?.totalizacaoFinal ? (
            <Badge variant="success">Totalização final</Badge>
          ) : (
            <Badge variant="muted">Em apuração</Badge>
          )
        }
        subtitle={<>Brasil · {formatDateTime(race.data?.atualizadoEm)}</>}
      />

      <TotalizadasCard value={race.data?.secoes.percentualTotalizadas ?? 0} />

      {race.isLoading || !race.data ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <RaceDetail
          race={race.data}
          cargo={cargo!}
          maxBarras={12}
          side={
            <>
              <TurnoutPanel race={race.data} />
              {historico.data?.snapshots && historico.data.snapshots.length > 1 ? (
                <SnapshotTimeline snapshots={historico.data.snapshots} />
              ) : null}
            </>
          }
        />
      )}
    </div>
  );
}
