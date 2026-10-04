import type { ReactNode } from "react";
import type { Cargo } from "@apuracao/shared";
import type { RaceResult } from "@apuracao/domain";
import { RaceBoard } from "@/components/race-board";

/**
 * Layout padrão de uma corrida: placar (2/3) + coluna lateral (1/3) com
 * comparecimento, evolução e seções extras.
 */
export function RaceDetail({
  race,
  cargo,
  maxBarras,
  side,
}: {
  race: RaceResult;
  cargo: Cargo;
  maxBarras?: number;
  side: ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <RaceBoard race={race} cargo={cargo} maxBarras={maxBarras} />
      </div>
      <div className="min-w-0 space-y-4">{side}</div>
    </div>
  );
}
