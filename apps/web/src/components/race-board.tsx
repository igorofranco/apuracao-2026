import type { Cargo } from "@apuracao/shared";
import { destaquesDoCargo } from "@apuracao/shared";
import type { RaceResult } from "@apuracao/domain";
import { CandidateBar } from "@/components/candidate-bar";
import { CandidatesTable } from "@/components/candidates-table";
import { SegundoTurnoBanner } from "@/components/segundo-turno";
import { Card } from "@/components/ui";
import {
  origemSegundoTurnoCandidato,
  segundoTurnoDaCorrida,
} from "@/lib/segundo-turno";

export function RaceBoard({
  race,
  cargo,
  maxBarras = 8,
}: {
  race: RaceResult;
  cargo: Cargo;
  maxBarras?: number;
}) {
  const majoritario = cargo.majoritario;
  const maxVotos = race.candidatos[0]?.votos ?? 0;
  // Senador renova 2 vagas por estado em 2026: os dois primeiros em destaque.
  const destaques = destaquesDoCargo(cargo.codigo);
  // Presidente/Governador: quando os dois que vão ao 2º turno já estão
  // definidos, eles ganham uma faixa e um realce próprio.
  const segundoTurno = majoritario ? segundoTurnoDaCorrida(race) : null;

  if (majoritario) {
    return (
      <Card className="min-w-0 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{cargo.nome}</h2>
          <span className="text-xs text-muted-foreground">
            {race.candidatos.length} candidatos
          </span>
        </div>
        {segundoTurno ? (
          <div className="mb-4">
            <SegundoTurnoBanner disputa={segundoTurno} />
          </div>
        ) : null}
        <div className="space-y-4">
          {race.candidatos.slice(0, maxBarras).map((c, i) => {
            const origem = origemSegundoTurnoCandidato(c);
            return (
              <CandidateBar
                key={c.numero + c.nome}
                candidato={c}
                maxVotos={maxVotos}
                destaque={maxVotos > 0 && (i < destaques || origem !== null)}
                segundoTurno={origem}
              />
            );
          })}
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
