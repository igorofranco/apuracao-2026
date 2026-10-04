"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ELEICAO_2026, UFS, getCargo } from "@apuracao/shared";
import { useResumo, useResultado } from "@/lib/queries";
import { LiveBadge } from "@/components/live-badge";
import { CandidateBar } from "@/components/candidate-bar";
import { NumeroBadge } from "@/components/numero-badge";
import { BrazilMap, type MapaDado } from "@/components/brazil-map";
import { MeuPainel } from "@/components/meu-painel";
import { Card, Progress, Skeleton } from "@/components/ui";
import { formatDateTime, formatPercent } from "@/lib/format";

export default function HomePage() {
  const resumo = useResumo();
  const presidente = useResultado({
    eleicao: ELEICAO_2026.eleicoes.federal,
    cargo: 1,
    uf: "br",
  });

  const corridas = resumo.data?.corridas ?? [];

  const porChave = useMemo(() => {
    const m = new Map<string, (typeof corridas)[number]>();
    for (const c of corridas) m.set(`${c.cargo}:${c.uf}`, c);
    return m;
  }, [corridas]);

  const presResumo = porChave.get("1:br");

  const mapaDados: MapaDado[] = useMemo(
    () =>
      UFS.map((u) => {
        const r = porChave.get(`3:${u.uf}`);
        return {
          uf: u.uf,
          percentual: r?.percentualApurado ?? 0,
          lider: r?.lider
            ? {
                nomeUrna: r.lider.nomeUrna,
                siglaPartido: r.lider.partido,
                votos: r.lider.votos,
                percentual: r.lider.percentual,
              }
            : null,
        };
      }),
    [porChave],
  );

  const lider = presResumo?.lider ?? null;
  const maxVotos = presidente.data?.candidatos[0]?.votos ?? 0;
  const apuracaoIniciada = maxVotos > 0;
  const cargoPres = getCargo(1);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Eleições Gerais 2026</h1>
          <p className="text-sm text-muted-foreground">
            1º turno · 04/10/2026 · dados oficiais do TSE
            {presResumo?.atualizadoEm
              ? ` · atualizado ${formatDateTime(presResumo.atualizadoEm)}`
              : ""}
          </p>
        </div>
        <LiveBadge />
      </section>

      {resumo.isError || presidente.isError ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Não foi possível carregar os dados do TSE agora. O serviço de coleta pode estar
          reiniciando — os números aparecem assim que a conexão for restabelecida.
        </Card>
      ) : null}

      <MeuPainel />

      {/* Presidente */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-1 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{cargoPres?.nome}</h2>
            <span className="tabular text-2xl font-bold">
              {formatPercent(presidente.data?.secoes.percentualTotalizadas ?? 0, 1)}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">das seções totalizadas</p>
          <Progress
            value={presidente.data?.secoes.percentualTotalizadas ?? 0}
            label="Seções totalizadas"
          />
          <div className="mt-4 min-h-[4.5rem]">
            {lider ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Liderança
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <NumeroBadge numero={lider.numero} destaque tamanho="md" />
                  <span className="min-w-0 truncate font-semibold">{lider.nomeUrna}</span>
                  <span className="ml-auto tabular font-semibold">
                    {formatPercent(lider.percentual)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Apuração ainda não iniciada.
              </p>
            )}
          </div>
          <Link
            href="/presidente"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Ver apuração completa →
          </Link>
        </Card>

        <Card className="min-w-0 lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Disputa presidencial</h2>
            <span className="text-xs text-muted-foreground">
              {apuracaoIniciada ? "Top candidatos" : "Aguardando votos"}
            </span>
          </div>
          {presidente.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : presidente.data ? (
            <div className="space-y-3">
              {presidente.data.candidatos.slice(0, 6).map((c, i) => (
                <CandidateBar
                  key={c.numero + c.nome}
                  candidato={c}
                  maxVotos={maxVotos}
                  destaque={i === 0 && apuracaoIniciada}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          )}
        </Card>
      </section>

      {/* Mapa */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Governadores por estado</h2>
            <span className="text-xs text-muted-foreground">
              cor = partido do líder
            </span>
          </div>
          <BrazilMap dados={mapaDados} modo="lideranca" />
        </Card>

        <Card className="min-w-0 lg:col-span-2 p-5">
          <h2 className="mb-3 text-lg font-semibold">Andamento por estado</h2>
          {corridas.length === 0 ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {UFS.map((u) => {
                const r = porChave.get(`3:${u.uf}`);
                return (
                  <li key={u.uf}>
                    <Link
                      href={`/uf/${u.uf}`}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-primary/50"
                    >
                      <span className="w-8 font-semibold uppercase">{u.uf}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {r?.lider ? (
                          <>
                            {r.lider.nomeUrna}
                            <span className="ml-1">({r.lider.partido})</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="tabular w-14 text-right text-muted-foreground">
                        {formatPercent(r?.percentualApurado ?? 0, 0)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* Grid de governadores */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Governador por estado</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {UFS.map((u) => {
            const r = porChave.get(`3:${u.uf}`);
            return (
              <Link
                key={u.uf}
                href={`/uf/${u.uf}`}
                className="min-w-0 rounded-xl border border-border bg-card p-3 transition hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{u.nome}</span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatPercent(r?.percentualApurado ?? 0, 0)}
                  </span>
                </div>
                <div className="mt-1 min-h-[2.5rem]">
                  {r?.lider ? (
                    <>
                      <div className="truncate text-sm">{r.lider.nomeUrna}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.lider.partido} · {formatPercent(r.lider.percentual, 1)}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <Progress
                  value={r?.percentualApurado ?? 0}
                  label={`Seções totalizadas em ${u.nome}`}
                  className="mt-2 h-1.5"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
