"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ELEICAO_2026, getUf } from "@apuracao/shared";
import { useMunicipios, useResultado } from "@/lib/queries";
import { CargoTabs, useCargoAtivo } from "@/components/cargo-tabs";
import { ErrorCard } from "@/components/error-card";
import { RaceDetail } from "@/components/race-detail";
import { RaceHeader } from "@/components/race-header";
import { TotalizadasCard } from "@/components/totalizadas-card";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Card, Skeleton, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

function MunicipioContent() {
  const params = useParams<{ uf: string; municipio: string }>();
  const uf = (params.uf ?? "").toLowerCase();
  const municipio = params.municipio ?? "";
  const ufInfo = getUf(uf);
  const { cargos, cargoAtivo, selecionar } = useCargoAtivo(
    uf,
    `/uf/${uf}/${municipio}`,
  );

  const municipios = useMunicipios({
    eleicao: ELEICAO_2026.eleicoes.estadual,
    uf,
  });
  const municipioInfo = municipios.data?.municipios.find((m) => m.cd === municipio);

  const race = useResultado({
    eleicao: ELEICAO_2026.eleicoes.estadual,
    cargo: cargoAtivo?.codigo ?? 3,
    uf,
    municipio,
  });

  if (!ufInfo) {
    return <ErrorCard>UF inválida.</ErrorCard>;
  }

  const nomeMunicipio = municipioInfo?.nome ?? `Município ${municipio}`;
  const zonas = municipioInfo?.zonas ?? [];

  return (
    <div className="space-y-6">
      <RaceHeader
        crumbs={[
          { label: "Painel", href: "/" },
          { label: ufInfo.nome, href: `/uf/${uf}` },
        ]}
        title={nomeMunicipio}
        subtitle={
          <>
            {cargoAtivo?.nome} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </>
        }
      />

      <CargoTabs cargos={cargos} ativo={cargoAtivo} onSelecionar={selecionar} />

      {race.isError ? (
        <ErrorCard>
          Sem dados para este município/cargo (ou apuração ainda não iniciada).
          {zonas.length ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Zonas eleitorais</p>
              <div className="flex flex-wrap gap-2">
                {zonas.map((z) => (
                  <Link
                    key={z}
                    href={`/uf/${uf}/${municipio}/zona/${z}?cargo=${cargoAtivo?.codigo ?? 3}`}
                    className={buttonClass("outline")}
                  >
                    Zona {z}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </ErrorCard>
      ) : race.isLoading || !race.data || !cargoAtivo ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <TotalizadasCard value={race.data.secoes.percentualTotalizadas} />

          <RaceDetail
            race={race.data}
            cargo={cargoAtivo}
            side={
              <>
                <TurnoutPanel race={race.data} />
                {zonas.length ? (
                  <Card className="p-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Zonas eleitorais
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {zonas.map((z) => (
                        <Link
                          key={z}
                          href={`/uf/${uf}/${municipio}/zona/${z}?cargo=${cargoAtivo.codigo}`}
                          className={buttonClass("outline", "px-2.5 py-1 text-xs")}
                        >
                          {z}
                        </Link>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </>
            }
          />
        </>
      )}
    </div>
  );
}

export default function MunicipioPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <MunicipioContent />
    </Suspense>
  );
}
