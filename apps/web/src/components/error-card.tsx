import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/** Mensagem de indisponibilidade padrão das páginas de apuração. */
export function ErrorCard({ children }: { children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="text-sm text-muted-foreground">{children}</div>
    </Card>
  );
}
