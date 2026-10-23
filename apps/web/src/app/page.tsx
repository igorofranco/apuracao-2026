"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UFS } from "@apuracao/shared";
import { useEleicoes, useResumo, useResultado } from "@/lib/queries";
import { PresidenteSegundoTurno } from "@/components/presidente-segundo-turno";
import { BrazilMap, type MapaDado } from "@/components/brazil-map";
import { Card, Progress, Segmented, Skeleton } from "@/components/ui";
import { formatPercent } from "@/lib/format";

export default function HomePage() {
  const eleicoes = useEleicoes();
  const resumo = useResumo();
  const presidente = useResultado({
    eleicao: eleicoes.federal.cd,
    cargo: 1,
    uf: "br",
  });

  const [mapaModo, setMapaModo] = useState<"lideranca" | "apuracao">("lideranca");
  const [mapaEscala, setMapaEscala] = useState<"absoluto" | "relativo">("absoluto");

  const corridas = resumo.data?.corridas ?? [];

  const porChave = useMemo(() => {
    const m = new Map<string, (typeof corridas)[number]>();
    for (const c of corridas) {
      const chave = `${c.cargo}:${c.uf}`;
      const atual = m.get(chave);
      // Governador: prefere o resultado do turno atual (2º turno); nos estados
      // sem disputa, mantém o do 1º turno (já decidido).
      if (
        !atual ||
        (c.eleicao === eleicoes.estadual.cd && atual.eleicao !== eleicoes.estadual.cd)
      ) {
        m.set(chave, c);
      }
    }
    return m;
  }, [corridas, eleicoes.estadual.cd]);

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

  return (
    <div className="space-y-8">
      {resumo.isError || presidente.isError ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Não foi possível carregar os dados do TSE agora. O serviço de coleta pode estar
          reiniciando — os números aparecem assim que a conexão for restabelecida.
        </Card>
      ) : null}

      {/* 2º turno: só os dois candidatos, em evidência */}
      <PresidenteSegundoTurno
        race={presidente.data}
        carregando={presidente.isLoading}
        turno={eleicoes.federal.turno}
        data={eleicoes.federal.data}
      />

      {/* Mapa */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3 p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Governadores por estado</h2>
            <Segmented
              value={mapaModo}
              onChange={setMapaModo}
              label="Tipo de mapa"
              options={[
                { value: "lideranca", label: "Liderança" },
                { value: "apuracao", label: "Apuração" },
              ]}
            />
          </div>
          {mapaModo === "lideranca" ? (
            <p className="mb-1 text-xs text-muted-foreground">cor = partido do líder</p>
          ) : (
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                cor = percentual de urnas apuradas
              </p>
              <Segmented
                value={mapaEscala}
                onChange={setMapaEscala}
                label="Escala do mapa de apuração"
                options={[
                  { value: "absoluto", label: "Absoluto" },
                  { value: "relativo", label: "Relativo" },
                ]}
              />
            </div>
          )}
          <BrazilMap dados={mapaDados} modo={mapaModo} escala={mapaEscala} />
        </Card>

        <Card className="flex min-w-0 flex-col lg:col-span-2 p-5">
          <h2 className="mb-3 text-lg font-semibold">Andamento por estado</h2>
          {corridas.length === 0 ? (
            <Skeleton className="h-[420px] w-full lg:h-auto lg:flex-1" />
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
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
