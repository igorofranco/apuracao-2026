import type { ReactNode } from "react";
import { Card, Progress } from "@/components/ui";
import { formatPercent } from "@/lib/format";

/** Card "seções totalizadas" com barra de progresso, comum às páginas de corrida. */
export function TotalizadasCard({
  label = "Seções totalizadas",
  value,
}: {
  label?: ReactNode;
  value: number;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular text-lg font-semibold">{formatPercent(value)}</span>
      </div>
      <Progress value={value} />
    </Card>
  );
}
