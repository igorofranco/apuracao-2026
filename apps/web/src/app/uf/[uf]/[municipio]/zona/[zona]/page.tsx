"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ELEICAO_2026, getCargo, getUf } from "@apuracao/shared";
import { useResultado } from "@/lib/queries";
import { useCargoAtivo } from "@/components/cargo-tabs";
import { ErrorCard } from "@/components/error-card";
import { RaceDetail } from "@/components/race-detail";
import { RaceHeader } from "@/components/race-header";
import { TotalizadasCard } from "@/components/totalizadas-card";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

function ZonaContent() {
  const params = useParams<{ uf: string; municipio: string; zona: string }>();
  const uf = (params.uf ?? "").toLowerCase();
  const municipio = params.municipio ?? "";
  const zona = params.zona ?? "";
  const ufInfo = getUf(uf);
  const { cargoAtivo } = useCargoAtivo(uf, `/uf/${uf}/${municipio}/zona/${zona}`);
  const cargo = cargoAtivo ?? getCargo(3);

  const race = useResultado({
    eleicao: ELEICAO_2026.eleicoes.estadual,
    cargo: cargo?.codigo ?? 3,
    uf,
    municipio,
    zona,
  });

  return (
    <div className="space-y-6">
      <RaceHeader
        crumbs={[
          { label: "Painel", href: "/" },
          { label: ufInfo?.nome ?? uf.toUpperCase(), href: `/uf/${uf}` },
          {
            label: `Município ${municipio}`,
            href: `/uf/${uf}/${municipio}?cargo=${cargo?.codigo ?? 3}`,
          },
        ]}
        title={`Zona ${zona}`}
        subtitle={
          <>
            {cargo?.nome} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </>
        }
      />

      {race.isError ? (
        <ErrorCard>
          Sem dados para esta zona/cargo (ou apuração ainda não iniciada).
        </ErrorCard>
      ) : race.isLoading || !race.data || !cargo ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <TotalizadasCard value={race.data.secoes.percentualTotalizadas} />
          <RaceDetail
            race={race.data}
            cargo={cargo}
            side={<TurnoutPanel race={race.data} />}
          />
        </>
      )}
    </div>
  );
}

export default function ZonaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <ZonaContent />
    </Suspense>
  );
}
