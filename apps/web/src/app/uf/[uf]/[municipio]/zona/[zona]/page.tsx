"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ELEICAO_2026, cargosDaUf, getCargo, getUf, isUf } from "@apuracao/shared";
import { useResultado } from "@/lib/queries";
import { LiveBadge } from "@/components/live-badge";
import { RaceBoard } from "@/components/race-board";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Card, Progress, Skeleton } from "@/components/ui";
import { formatDateTime, formatPercent } from "@/lib/format";

function ZonaContent() {
  const params = useParams<{ uf: string; municipio: string; zona: string }>();
  const search = useSearchParams();
  const uf = (params.uf ?? "").toLowerCase();
  const municipio = params.municipio ?? "";
  const zona = params.zona ?? "";
  const ufInfo = getUf(uf);
  const cargoParam = Number(search.get("cargo"));
  const cargos = isUf(uf) ? cargosDaUf(uf) : [];
  const cargo = cargos.find((c) => c.codigo === cargoParam) ?? getCargo(3);

  const race = useResultado({
    eleicao: ELEICAO_2026.eleicoes.estadual,
    cargo: cargo?.codigo ?? 3,
    uf,
    municipio,
    zona,
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Painel
            </Link>
            <span>/</span>
            <Link href={`/uf/${uf}`} className="hover:underline">
              {ufInfo?.nome ?? uf.toUpperCase()}
            </Link>
            <span>/</span>
            <Link href={`/uf/${uf}/${municipio}?cargo=${cargo?.codigo ?? 3}`} className="hover:underline">
              Município {municipio}
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Zona {zona}</h1>
          <p className="text-sm text-muted-foreground">
            {cargo?.nome} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </p>
        </div>
        <LiveBadge />
      </section>

      {race.isError ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Sem dados para esta zona/cargo (ou apuração ainda não iniciada).
          </p>
        </Card>
      ) : race.isLoading || !race.data || !cargo ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Seções totalizadas</span>
              <span className="tabular text-lg font-semibold">
                {formatPercent(race.data.secoes.percentualTotalizadas)}
              </span>
            </div>
            <Progress value={race.data.secoes.percentualTotalizadas} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <RaceBoard race={race.data} cargo={cargo} />
            </div>
            <TurnoutPanel race={race.data} />
          </div>
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
