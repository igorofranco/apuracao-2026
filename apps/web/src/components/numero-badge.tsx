import { cn } from "@/lib/utils";

const tamanhos = {
  sm: "h-6 min-w-6 px-1.5 text-xs",
  md: "h-7 min-w-7 px-2 text-sm",
} as const;

/**
 * Número do candidato em destaque (partido/posição). Usado na barra, na
 * liderança do painel e no cabeçalho de corrida.
 */
export function NumeroBadge({
  numero,
  destaque = false,
  tamanho = "sm",
  className,
}: {
  numero: string;
  destaque?: boolean;
  tamanho?: keyof typeof tamanhos;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex items-center justify-center rounded-md font-semibold",
        tamanhos[tamanho],
        destaque
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {numero}
    </span>
  );
}
