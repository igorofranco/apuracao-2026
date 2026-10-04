"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ELEICAO_2026, getUf } from "@apuracao/shared";
import { useHistorico, useMunicipios, useResultado } from "@/lib/queries";
import { CargoTabs, useCargoAtivo } from "@/components/cargo-tabs";
import { ErrorCard } from "@/components/error-card";
import { RaceDetail } from "@/components/race-detail";
import { RaceHeader } from "@/components/race-header";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TotalizadasCard } from "@/components/totalizadas-card";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Badge, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

function UfContent() {
  const params = useParams<{ uf: string }>();
  const uf = (params.uf ?? "").toLowerCase();
  const ufInfo = getUf(uf);
  const { cargos, cargoAtivo, selecionar } = useCargoAtivo(uf, `/uf/${uf}`);

  const resultadoParams = cargoAtivo
    ? { eleicao: ELEICAO_2026.eleicoes.estadual, cargo: cargoAtivo.codigo, uf }
    : null;

  const race = useResultado(
    resultadoParams ?? { eleicao: 0, cargo: 0, uf: "" },
  );
  const historico = useHistorico(
    resultadoParams ?? { eleicao: 0, cargo: 0, uf: "" },
  );
  const municipios = useMunicipios({
    eleicao: ELEICAO_2026.eleicoes.estadual,
    uf,
  });

  const [busca, setBusca] = useState("");
  const listaMunicipios = useMemo(() => {
    const list = municipios.data?.municipios ?? [];
    if (!busca.trim()) return list.slice(0, 60);
    const termo = busca.trim().toLowerCase();
    return list.filter((m) => m.nome.toLowerCase().includes(termo)).slice(0, 100);
  }, [municipios.data, busca]);

  if (!ufInfo) {
    return <ErrorCard>UF inválida: {uf}</ErrorCard>;
  }

  return (
    <div className="space-y-6">
      <RaceHeader
        crumbs={[{ label: "Painel", href: "/" }]}
        title={ufInfo.nome}
        badge={
          race.data?.totalizacaoFinal ? (
            <Badge variant="success">Finalizado</Badge>
          ) : null
        }
        subtitle={
          <>
            {ufInfo.regiao} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </>
        }
      />

      <CargoTabs cargos={cargos} ativo={cargoAtivo} onSelecionar={selecionar} />

      <TotalizadasCard
        label={<>{cargoAtivo?.nome} · seções totalizadas</>}
        value={race.data?.secoes.percentualTotalizadas ?? 0}
      />

      {race.isError ? (
        <ErrorCard>
          Não foi possível carregar os dados de {ufInfo.nome} agora. Pode ser uma
          instabilidade momentânea — tente novamente em instantes.
        </ErrorCard>
      ) : race.isLoading || !race.data || !cargoAtivo ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <RaceDetail
          race={race.data}
          cargo={cargoAtivo}
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

      {/* Municípios */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Municípios
            {municipios.data ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {municipios.data.total}
              </span>
            ) : null}
          </h2>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar município…"
            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
          />
        </div>
        {municipios.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {listaMunicipios.map((m) => (
              <Link
                key={m.cd}
                href={`/uf/${uf}/${m.cd}?cargo=${cargoAtivo?.codigo ?? 3}`}
                className="min-w-0 truncate rounded-lg border border-border bg-card px-3 py-2 text-sm transition hover:border-primary/50"
              >
                {m.nome}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function UfPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <UfContent />
    </Suspense>
  );
}
