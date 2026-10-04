"use client";

import {
  CartesianGrid,
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

export function SnapshotTimeline({ snapshots }: { snapshots: Snapshot[] }) {
  const data = snapshots.map((s) => ({
    hora: formatHora(s.capturadoEm).slice(0, 5),
    apurado: s.percentualApurado,
    validos: s.votosValidos,
  }));

  const ultimo = snapshots.at(-1);
  const primeiro = snapshots[0];
  const deltaValidos =
    ultimo && primeiro ? ultimo.votosValidos - primeiro.votosValidos : 0;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Evolução
        </h3>
        <span className="text-xs text-muted-foreground">
          {snapshots.length} amostras · +{formatInt(deltaValidos)} válidos
        </span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={11} minTickGap={24} />
            <YAxis
              yAxisId="validos"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickFormatter={(v: number) => formatInt(v)}
            />
            <YAxis
              yAxisId="apurado"
              orientation="right"
              stroke="var(--muted-foreground)"
              fontSize={11}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const v = Number(value);
                return name === "apurado"
                  ? [formatPercent(v), "% apurado"]
                  : [formatInt(v), "Votos válidos"];
              }}
            />
            <Line
              yAxisId="validos"
              type="monotone"
              dataKey="validos"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="apurado"
              type="monotone"
              dataKey="apurado"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
