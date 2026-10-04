"use client";

import Link from "next/link";
import type { RaceSummary } from "@apuracao/domain";
import { useResultado } from "@/lib/queries";
import { CandidateRow } from "@/components/candidate-row";
import { Card, Progress, Skeleton } from "@/components/ui";
import { formatPercent } from "@/lib/format";
import {
  eleicaoDoCargo,
  hrefCorrida,
  rotuloCorrida,
  type CorridaFixada,
  type TopN,
} from "@/lib/painel";

/**
 * Card compacto de uma corrida fixada: andamento + os `topN` candidatos mais
 * votados. Alimentado por `/api/resultado` (o SSE mantém a query viva, então o
 * card atualiza sozinho). Usa o `resumo` como fallback quando o resultado ainda
 * não chegou.
 */
export function RaceMiniCard({
  corrida,
  topN,
  resumo,
}: {
  corrida: CorridaFixada;
  topN: TopN;
  resumo?: RaceSummary;
}) {
  const { titulo, local } = rotuloCorrida(corrida);

  const resultado = useResultado(
    {
      eleicao: eleicaoDoCargo(corrida.cargo),
      cargo: corrida.cargo,
      uf: corrida.uf,
    },
    { retry: 1 },
  );

  const race = resultado.data;
  const candidatos = race?.candidatos.slice(0, topN) ?? [];
  const maxVotos = race?.candidatos[0]?.votos ?? 0;
  const percentual = race?.secoes.percentualTotalizadas ?? resumo?.percentualApurado ?? 0;
  const finalizado = race?.totalizacaoFinal ?? resumo?.totalizacaoFinal ?? false;
  const aguardandoColeta = resultado.isError && !race && !resumo;

  return (
    <Card
      className="flex min-w-0 flex-col p-4"
      data-testid="race-mini-card"
      data-corrida={`${corrida.cargo}:${corrida.uf}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{titulo}</h3>
          <p className="truncate text-xs text-muted-foreground">{local}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-lg font-bold leading-none">
            {formatPercent(percentual, 0)}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            apurado
          </div>
        </div>
      </div>

      <Progress
        value={percentual}
        label={`Seções totalizadas — ${titulo} ${local}`}
        className="mt-3 h-1.5"
        barClassName={finalizado ? "bg-success" : undefined}
      />

      <div className="mt-4 flex-1 space-y-2">
        {resultado.isLoading && !race ? (
          Array.from({ length: topN }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))
        ) : aguardandoColeta ? (
          <p className="text-sm text-muted-foreground">
            Aguardando a coleta desta corrida.
          </p>
        ) : candidatos.length > 0 ? (
          <ul className="divide-y divide-border">
            {candidatos.map((c, i) => (
              <CandidateRow
                key={c.numero + c.nome}
                candidato={c}
                destaque={i === 0 && maxVotos > 0}
                className="py-2 first:pt-0 last:pb-0"
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Apuração ainda não iniciada.</p>
        )}
      </div>

      <Link
        href={hrefCorrida(corrida)}
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        Ver apuração completa →
      </Link>
    </Card>
  );
}
