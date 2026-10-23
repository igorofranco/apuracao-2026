"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Snapshot } from "@apuracao/domain";
import { Card } from "@/components/ui";
import { formatHora, formatInt, formatPercent } from "@/lib/format";
import { recortarEvolucao } from "@/lib/evolucao";

/**
 * Paleta de alto contraste para as linhas (funciona nos temas claro e escuro).
 * A legenda identifica o candidato e o partido.
 */
const CORES = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function SnapshotTimeline({ snapshots }: { snapshots: Snapshot[] }) {
  const evolucao = recortarEvolucao(snapshots);
  const uteis = evolucao.snapshots;
  const candidatos = evolucao.candidatos;

  // Pivota os snapshots para o formato do Recharts: uma coluna por candidato.
  const data = uteis.map((snapshot) => {
    const ponto: Record<string, string | number | null> = {
      hora: formatHora(snapshot.capturadoEm).slice(0, 5),
    };
    candidatos.forEach((candidato, i) => {
      const encontrado = snapshot.candidatos?.find(
        (c) => c.numero === candidato.numero,
      );
      ponto[`c${i}`] = encontrado?.percentual ?? null;
    });
    return ponto;
  });

  const percentuais = candidatos.flatMap((_, i) =>
    data
      .map((p) => p[`c${i}`])
      .filter((v): v is number => typeof v === "number"),
  );
  const min = percentuais.length
    ? Math.max(0, Math.floor(Math.min(...percentuais) - 2))
    : 0;
  const max = percentuais.length
    ? Math.min(100, Math.ceil(Math.max(...percentuais) + 2))
    : 100;

  const primeiro = uteis[0];
  const ultimo = uteis.at(-1);
  const deltaValidos =
    primeiro && ultimo ? ultimo.votosValidos - primeiro.votosValidos : 0;
  const faixa =
    primeiro && ultimo
      ? `${formatHora(primeiro.capturadoEm).slice(0, 5)}–${formatHora(ultimo.capturadoEm).slice(0, 5)}`
      : null;

  if (uteis.length === 0 || candidatos.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Evolução
          </h3>
          <p className="text-xs text-muted-foreground">
            percentual de cada candidato ao longo da apuração
          </p>
        </div>
        <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
          Sem variação relevante na apuração para desenhar a evolução.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-1">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Evolução
          </h3>
          <p className="text-xs text-muted-foreground">
            % de cada candidato ao longo da apuração
          </p>
        </div>
        <span className="text-right text-xs text-muted-foreground">
          {uteis.length === 1 ? "1 amostra útil" : `${uteis.length} amostras úteis`}
          {evolucao.recortado ? ` de ${snapshots.length}` : ""}
          {faixa ? ` · ${faixa}` : ""}
        </span>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hora"
              stroke="var(--muted-foreground)"
              fontSize={11}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              domain={[min, max]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(hora) => `Às ${hora}`}
              formatter={(value) => formatPercent(Number(value))}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
            {candidatos.map((candidato, i) => (
              <Line
                key={candidato.numero}
                type="monotone"
                dataKey={`c${i}`}
                name={`${candidato.nomeUrna} (${candidato.siglaPartido})`}
                stroke={CORES[i % CORES.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {evolucao.recortado
          ? "Início/fim sem mudança ocultados. "
          : ""}
        {deltaValidos > 0 ? `+${formatInt(deltaValidos)} votos válidos no trecho.` : null}
      </p>
    </Card>
  );
}
