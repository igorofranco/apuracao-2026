"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ELEICAO_2026,
  cargosDaUf,
  getUf,
  isUf,
  type Cargo,
} from "@apuracao/shared";
import { useHistorico, useMunicipios, useResultado } from "@/lib/queries";
import { LiveBadge } from "@/components/live-badge";
import { RaceBoard } from "@/components/race-board";
import { SnapshotTimeline } from "@/components/snapshot-timeline";
import { TurnoutPanel } from "@/components/turnout-panel";
import { Badge, Card, Progress, Skeleton, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPercent } from "@/lib/format";

function UfContent() {
  const params = useParams<{ uf: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const uf = (params.uf ?? "").toLowerCase();
  const ufInfo = getUf(uf);
  const cargos = useMemo(() => (isUf(uf) ? cargosDaUf(uf) : []), [uf]);
  const cargoParam = Number(search.get("cargo"));
  const [cargoSel, setCargoSel] = useState<number | null>(null);

  const cargoAtivo: Cargo | undefined =
    cargos.find((c) => c.codigo === (cargoSel ?? cargoParam)) ?? cargos[0];

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
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">UF inválida: {uf}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              Painel
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-bold">{ufInfo.nome}</h1>
            {race.data?.totalizacaoFinal ? (
              <Badge variant="success">Finalizado</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {ufInfo.regiao} · atualizado {formatDateTime(race.data?.atualizadoEm)}
          </p>
        </div>
        <LiveBadge />
      </section>

      {/* Abas de cargo */}
      <div className="flex flex-wrap gap-1">
        {cargos.map((c) => (
          <button
            key={c.codigo}
            type="button"
            onClick={() => {
              setCargoSel(c.codigo);
              router.replace(`/uf/${uf}?cargo=${c.codigo}`);
            }}
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

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            {cargoAtivo?.nome} · seções totalizadas
          </span>
          <span className="tabular text-lg font-semibold">
            {formatPercent(race.data?.secoes.percentualTotalizadas ?? 0)}
          </span>
        </div>
        <Progress value={race.data?.secoes.percentualTotalizadas ?? 0} />
      </Card>

      {race.isLoading || !race.data || !cargoAtivo ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RaceBoard race={race.data} cargo={cargoAtivo} />
          </div>
          <div className="space-y-4">
            <TurnoutPanel race={race.data} />
            {historico.data?.snapshots && historico.data.snapshots.length > 1 ? (
              <SnapshotTimeline snapshots={historico.data.snapshots} />
            ) : null}
          </div>
        </div>
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
                className="truncate rounded-lg border border-border bg-card px-3 py-2 text-sm transition hover:border-primary/50"
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
