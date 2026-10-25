"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type {
  GraficoCandidato,
  GraficoPonto,
  GraficoResponse,
} from "@/lib/api";
import type { CandidatoMapa } from "@/lib/mapa";
import { dominioGrafico, type EscalaGrafico } from "@/lib/grafico";
import { formatHora, formatPercent } from "@/lib/format";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Linha pivotada para o Recharts (uma chave numérica por candidato). */
type Linha = {
  em: string;
  apurado: number;
  [key: string]: string | number | null;
};

type Serie = GraficoCandidato & { chave: string; cor: string };

/** Cores de reserva caso o candidato não seja um dos dois do mapa. */
const CORES_RESERVA = ["#ef4444", "#3b82f6"];

function corDoCandidato(
  candidato: GraficoCandidato,
  indice: number,
  candidatoA: CandidatoMapa,
  candidatoB: CandidatoMapa,
): string {
  if (candidato.numero === candidatoA.numero) return candidatoA.cor;
  if (candidato.numero === candidatoB.numero) return candidatoB.cor;
  return CORES_RESERVA[indice % CORES_RESERVA.length] ?? "#6b7280";
}

function ultimoPercentual(serie: Serie, linhas: Linha[]): number | null {
  for (let i = linhas.length - 1; i >= 0; i--) {
    const valor = linhas[i]?.[serie.chave];
    if (typeof valor === "number") return valor;
  }
  return null;
}

function TooltipEvolucao({
  active,
  payload,
  series,
}: TooltipContentProps & { series: Serie[] }) {
  if (!active || !payload?.length) return null;
  const linha = payload[0]?.payload as Linha | undefined;
  if (!linha) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold">{formatHora(linha.em)}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {formatPercent(linha.apurado, 1)} das seções totalizadas
      </div>
      <div className="mt-1.5 space-y-0.5">
        {series.map((serie) => (
          <div
            key={serie.numero}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: serie.cor }}
                aria-hidden
              />
              <span className="truncate">{serie.nomeUrna}</span>
            </span>
            <span className="tabular shrink-0 font-medium">
              {formatPercent(
                linha[serie.chave] as number | null | undefined,
                1,
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gráfico de evolução do 2º turno: duas linhas (uma por candidato), eixo X no
 * tempo e eixo Y no percentual dos votos válidos. O payload já chega recortado
 * do collector (sem o início sem dados e sem a repetição final).
 */
export function GraficoEvolucao({
  data,
  carregando = false,
  erro = false,
  escala,
  candidatoA,
  candidatoB,
  className,
}: {
  data: GraficoResponse | undefined;
  carregando?: boolean;
  erro?: boolean;
  /** Relativo: mín/máx dos dados; absoluto: 0–100%. */
  escala: EscalaGrafico;
  candidatoA: CandidatoMapa;
  candidatoB: CandidatoMapa;
  className?: string;
}) {
  const series: Serie[] = (data?.candidatos ?? []).map((candidato, indice) => ({
    ...candidato,
    chave: `c${indice}`,
    cor: corDoCandidato(candidato, indice, candidatoA, candidatoB),
  }));

  const linhas: Linha[] = (data?.pontos ?? []).map(
    (ponto: GraficoPonto) => {
      const linha: Linha = {
        em: ponto.em,
        apurado: ponto.percentualApurado,
      };
      for (const serie of series) {
        linha[serie.chave] = ponto.percentuais[serie.numero] ?? null;
      }
      return linha;
    },
  );

  const base = cn(
    "mt-2 flex min-h-0 flex-1 flex-col rounded-xl",
    className,
  );

  if (carregando) {
    return (
      <div
        data-testid="grafico-evolucao"
        data-estado="carregando"
        data-escala={escala}
        className={base}
      >
        <Skeleton className="min-h-[10rem] w-full flex-1 rounded-xl" />
      </div>
    );
  }

  if (erro) {
    return (
      <div
        data-testid="grafico-evolucao"
        data-estado="erro"
        data-escala={escala}
        className={cn(base, "items-center justify-center border border-dashed")}
      >
        <p className="text-center text-sm text-muted-foreground">
          Não foi possível carregar a evolução da apuração agora.
        </p>
      </div>
    );
  }

  if (linhas.length < 2 || series.length === 0) {
    return (
      <div
        data-testid="grafico-evolucao"
        data-estado="vazio"
        data-escala={escala}
        className={cn(base, "items-center justify-center border border-dashed")}
      >
        <div className="max-w-sm px-4 text-center">
          <p className="text-sm font-medium">Aguardando a evolução da apuração</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O gráfico aparece assim que os percentuais dos dois candidatos
            começarem a mudar.
          </p>
        </div>
      </div>
    );
  }

  const valores = linhas.flatMap((linha) =>
    series
      .map((serie) => linha[serie.chave])
      .filter((valor): valor is number => typeof valor === "number"),
  );
  const [min, max] = dominioGrafico(valores, escala);
  // Ticks explícitos: no relativo, eles acompanham exatamente o min/máx dos
  // dados (sem o "nice ticks" do Recharts criar intervalos irregulares).
  const ticksY = Array.from(
    { length: 5 },
    (_, indice) => min + ((max - min) * indice) / 4,
  );
  const casasEixo =
    escala === "absoluto" ? 0 : max - min < 1 ? 2 : 1;

  return (
    <div
      data-testid="grafico-evolucao"
      data-estado="pronto"
      data-escala={escala}
      data-dominio={`${min}:${max}`}
      className={base}
      role="group"
      aria-label={`Evolução do percentual de votos de ${series
        .map((serie) => serie.nomeUrna)
        .join(" e ")} ao longo da apuração`}
    >
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs">
        {series.map((serie) => (
          <span
            key={serie.numero}
            className="flex min-w-0 items-baseline gap-1.5"
          >
            <span
              className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
              style={{ background: serie.cor }}
              aria-hidden
            />
            <span className="min-w-0 truncate font-medium">
              {serie.nomeUrna}
            </span>
            <span className="tabular text-muted-foreground">
              {formatPercent(ultimoPercentual(serie, linhas), 1)}
            </span>
          </span>
        ))}
        <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">
          {data?.atualizadoEm
            ? `atualizado ${formatHora(data.atualizadoEm).slice(0, 5)}`
            : null}
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={linhas}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="em"
              stroke="var(--muted-foreground)"
              fontSize={11}
              minTickGap={28}
              tickMargin={6}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(valor: string) => formatHora(valor).slice(0, 5)}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              width={50}
              domain={[min, max]}
              ticks={ticksY}
              tickFormatter={(valor: number) => formatPercent(valor, casasEixo)}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={(props) => (
                <TooltipEvolucao {...props} series={series} />
              )}
            />
            {series.map((serie) => (
              <Line
                key={serie.numero}
                type="monotone"
                dataKey={serie.chave}
                name={serie.nomeUrna}
                stroke={serie.cor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 hidden shrink-0 text-[10px] text-muted-foreground sm:block">
        {data?.recortado ? "Início sem dados e fim repetido omitidos. " : ""}
        {data?.amostras
          ? `${data.amostras} ${data.amostras === 1 ? "amostra" : "amostras"} · `
          : ""}
        Percentual dos votos válidos.
      </p>
    </div>
  );
}
