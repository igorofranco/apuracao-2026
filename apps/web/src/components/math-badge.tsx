import { Badge } from "@/components/ui";

/**
 * Marcador de "matematicamente eleito": o candidato ainda não foi declarado
 * eleito pela totalização oficial, mas já não pode ser alcançado — mesmo que
 * todos os votos restantes fossem para os adversários. Fica visualmente
 * distinto do badge "Eleito" (verde) para não confundir com a marca do TSE.
 */
export function MathBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="accent"
      className={className}
      data-testid="badge-matematicamente-eleito"
      title="Matematicamente eleito: não pode mais ser alcançado mesmo que todos os votos restantes sejam dos adversários"
    >
      Matematicamente eleito
    </Badge>
  );
}
