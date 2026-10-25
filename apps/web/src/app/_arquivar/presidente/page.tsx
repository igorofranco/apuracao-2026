"use client";

import { useEleicoes, useHistorico, useResultado } from "@/lib/queries";
import { dataPresidencial } from "@/lib/eleicoes";
import { PresidenteSegundoTurno } from "@/components/presidente-segundo-turno";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TurnoutPanel } from "@/components/turnout-panel";

export default function PresidentePage() {
  const eleicoes = useEleicoes();
  const params = { eleicao: eleicoes.federal.cd, cargo: 1, uf: "br" };
  const race = useResultado(params);
  const historico = useHistorico(params);

  return (
    <div className="space-y-6">
      <PresidenteSegundoTurno
        race={race.data}
        turno={eleicoes.federal.turno}
        data={dataPresidencial(eleicoes)}
        mostrarLink={false}
      />

      {/*
       * Sem votos no 2º turno, ficam só os placeholders dos candidatos acima.
       * Apuração/evolução aparecem quando a votação começa.
       */}
      {race.data && race.data.votos.validos > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TurnoutPanel race={race.data} />
          {historico.data?.snapshots && historico.data.snapshots.length > 1 ? (
            <SnapshotTimeline snapshots={historico.data.snapshots} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
