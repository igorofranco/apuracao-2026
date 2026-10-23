"use client";

import { useEleicoes, useHistorico, useResultado } from "@/lib/queries";
import { ErrorCard } from "@/components/error-card";
import { PresidenteSegundoTurno } from "@/components/presidente-segundo-turno";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Skeleton } from "@/components/ui";

export default function PresidentePage() {
  const eleicoes = useEleicoes();
  const params = { eleicao: eleicoes.federal.cd, cargo: 1, uf: "br" };
  const race = useResultado(params);
  const historico = useHistorico(params);

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
      <PresidenteSegundoTurno
        race={race.data}
        carregando={race.isLoading}
        turno={eleicoes.federal.turno}
        data={eleicoes.federal.data}
        mostrarLink={false}
      />

      {race.isLoading || !race.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TurnoutPanel race={race.data} />
          {historico.data?.snapshots && historico.data.snapshots.length > 1 ? (
            <SnapshotTimeline snapshots={historico.data.snapshots} />
          ) : null}
        </div>
      )}
    </div>
  );
}
