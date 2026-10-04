"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ELEICAO_2026,
  cargosDaUf,
  getUf,
  isUf,
  type Cargo,
} from "@apuracao/shared";
import { useMunicipios, useResultado } from "@/lib/queries";
import { LiveBadge } from "@/components/live-badge";
import { RaceBoard } from "@/components/race-board";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Card, Progress, Skeleton, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPercent } from "@/lib/format";

function MunicipioContent() {
  const params = useParams<{ uf: string; municipio: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const uf = (params.uf ?? "").toLowerCase();
  const municipio = params.municipio ?? "";
  const ufInfo = getUf(uf);
  const cargos = useMemo(() => (isUf(uf) ? cargosDaUf(uf) : []), [uf]);
  const cargoParam = Number(search.get("cargo"));
  const cargoAtivo: Cargo | undefined =
    cargos.find((c) => c.codigo === cargoParam) ?? cargos[0];

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
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">UF inválida.</p>
      </Card>
    );
  }

  const nomeMunicipio = municipioInfo?.nome ?? `Município ${municipio}`;

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
              {ufInfo.nome}
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{nomeMunicipio}</h1>
          <p className="text-sm text-muted-foreground">
            {cargoAtivo?.nome} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </p>
        </div>
        <LiveBadge />
      </section>

      <div className="flex flex-wrap gap-1">
        {cargos.map((c) => (
          <button
            key={c.codigo}
            type="button"
            onClick={() => router.replace(`/uf/${uf}/${municipio}?cargo=${c.codigo}`)}
            className={cn(
              buttonClass("ghost", "px-3 py-1.5"),
              cargoAtivo?.codigo === c.codigo &&
                "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {c.curto}
          </button>
        ))}
      </div>

      {race.isError ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Sem dados para este município/cargo (ou apuração ainda não iniciada).
          </p>
          {municipioInfo?.zonas?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Zonas eleitorais</p>
              <div className="flex flex-wrap gap-2">
                {municipioInfo.zonas.map((z) => (
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
        </Card>
      ) : race.isLoading || !race.data || !cargoAtivo ? (
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
            <div className="lg:col-span-2">
              <RaceBoard race={race.data} cargo={cargoAtivo} />
            </div>
            <div className="space-y-4">
              <TurnoutPanel race={race.data} />
              {municipioInfo?.zonas?.length ? (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Zonas eleitorais
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {municipioInfo.zonas.map((z) => (
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
            </div>
          </div>
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
