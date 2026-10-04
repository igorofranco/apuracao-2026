"use client";

import { useEffect } from "react";
import { buttonClass, Card } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <h1 className="text-lg font-semibold">Algo deu errado</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Não foi possível carregar esta página. Pode ser uma instabilidade momentânea na
        conexão com os dados.
      </p>
      <button type="button" className={buttonClass("primary", "mt-4")} onClick={reset}>
        Tentar novamente
      </button>
    </Card>
  );
}
