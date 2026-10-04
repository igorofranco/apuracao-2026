"use client";

import { useLive } from "@/lib/live";
import { formatHora } from "@/lib/format";

export function LiveBadge({ className }: { className?: string }) {
  const { status, lastEventAt } = useLive();
  const label =
    status === "conectado"
      ? "Ao vivo"
      : status === "conectando"
        ? "Conectando…"
        : "Reconectando…";
  const color =
    status === "conectado"
      ? "bg-success"
      : status === "conectando"
        ? "bg-accent"
        : "bg-danger";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium ${className ?? ""}`}
      title={lastEventAt ? `Última atualização: ${formatHora(lastEventAt)}` : undefined}
    >
      <span className={`h-2 w-2 rounded-full ${color} ${status === "conectado" ? "animate-live" : ""}`} />
      <span>{label}</span>
      {lastEventAt ? (
        <span className="tabular text-muted-foreground">· {formatHora(lastEventAt)}</span>
      ) : null}
    </div>
  );
}
