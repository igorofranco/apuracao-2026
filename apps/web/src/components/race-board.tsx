import type { Cargo } from "@apuracao/shared";
import type { RaceResult } from "@apuracao/domain";
import { CandidateBar } from "@/components/candidate-bar";
import { CandidatesTable } from "@/components/candidates-table";
import { Card } from "@/components/ui";

const MAJORITARIOS = new Set([1, 3, 5]);

export function RaceBoard({
  race,
  cargo,
  maxBarras = 8,
}: {
  race: RaceResult;
  cargo: Cargo;
  maxBarras?: number;
}) {
  const majoritario = MAJORITARIOS.has(cargo.codigo);
  const maxVotos = race.candidatos[0]?.votos ?? 0;

  if (majoritario) {
    return (
      <Card className="min-w-0 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{cargo.nome}</h2>
          <span className="text-xs text-muted-foreground">
            {race.candidatos.length} candidatos
          </span>
        </div>
        <div className="space-y-4">
          {race.candidatos.slice(0, maxBarras).map((c, i) => (
            <CandidateBar
              key={c.numero + c.nome}
              candidato={c}
              maxVotos={maxVotos}
              destaque={i === 0 && maxVotos > 0}
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cargo.nome}</h2>
        <span className="text-xs text-muted-foreground">
          {race.candidatos.length} candidatos
        </span>
      </div>
      <CandidatesTable candidatos={race.candidatos} />
    </div>
  );
}
