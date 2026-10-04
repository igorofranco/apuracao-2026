"use client";

import { useMemo, useState } from "react";
import { CARGOS, UFS, cargosDaUf } from "@apuracao/shared";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  TOPS_DISPONIVEIS,
  chaveCorrida,
  rotuloCorrida,
  type CorridaFixada,
  type PainelConfig,
  type TopN,
} from "@/lib/painel";

const selectClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Editor do painel: adiciona/remove/reordena corridas e escolhe quantos
 * candidatos exibir. Não guarda estado próprio persistido — recebe a config e
 * os handlers do dono do `usePainel` (para não dessincronizar réplicas).
 */
export function PainelEditor({
  config,
  adicionar,
  remover,
  mover,
  setTopN,
  limpar,
}: {
  config: PainelConfig;
  adicionar: (corrida: CorridaFixada) => void;
  remover: (corrida: CorridaFixada) => void;
  mover: (corrida: CorridaFixada, direcao: -1 | 1) => void;
  setTopN: (topN: TopN) => void;
  limpar: () => void;
}) {
  const [uf, setUf] = useState("br");
  const [cargoCodigo, setCargoCodigo] = useState(1);

  const cargosDisponiveis = useMemo(
    () => (uf === "br" ? CARGOS.filter((c) => c.abrangencia === "federal") : cargosDaUf(uf)),
    [uf],
  );
  const cargoAtivo = cargosDisponiveis.find((c) => c.codigo === cargoCodigo) ?? cargosDisponiveis[0];

  const nova: CorridaFixada | null = cargoAtivo ? { cargo: cargoAtivo.codigo, uf } : null;
  const jaExiste =
    nova != null && config.itens.some((i) => chaveCorrida(i) === chaveCorrida(nova));

  const trocarUf = (valor: string) => {
    setUf(valor);
    const primeira = valor === "br" ? CARGOS[0] : cargosDaUf(valor)[0];
    setCargoCodigo(primeira?.codigo ?? 1);
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-3">
        <div>
          <label htmlFor="painel-uf" className="mb-1 block text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <select
            id="painel-uf"
            className={cn(selectClass, "w-full")}
            value={uf}
            onChange={(e) => trocarUf(e.target.value)}
          >
            <option value="br">Brasil (Presidente)</option>
            {UFS.map((u) => (
              <option key={u.uf} value={u.uf}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label
              htmlFor="painel-cargo"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Cargo
            </label>
            <select
              id="painel-cargo"
              className={cn(selectClass, "w-full")}
              value={cargoAtivo?.codigo ?? ""}
              onChange={(e) => setCargoCodigo(Number(e.target.value))}
            >
              {cargosDisponiveis.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={buttonClass("primary")}
            disabled={!nova || jaExiste}
            onClick={() => nova && adicionar(nova)}
          >
            {jaExiste ? "Já no painel" : "Adicionar"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Candidatos por corrida</span>
          <div className="flex gap-1">
            {TOPS_DISPONIVEIS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={config.topN === n}
                onClick={() => setTopN(n)}
                className={cn(
                  buttonClass("ghost", "px-2.5 py-1"),
                  config.topN === n && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>
        {config.itens.length > 0 ? (
          <button
            type="button"
            onClick={limpar}
            className="text-xs font-medium text-danger hover:underline"
          >
            Limpar painel
          </button>
        ) : null}
      </div>

      {config.itens.length > 0 ? (
        <ul className="space-y-2 border-t border-border pt-3">
          {config.itens.map((item, i) => {
            const { titulo, local } = rotuloCorrida(item);
            return (
              <li
                key={chaveCorrida(item)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{titulo}</span>
                  <span className="text-muted-foreground"> · {local}</span>
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Mover ${titulo} ${local} para cima`}
                    disabled={i === 0}
                    onClick={() => mover(item, -1)}
                    className={buttonClass("ghost", "h-7 w-7 p-0 disabled:opacity-30")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${titulo} ${local} para baixo`}
                    disabled={i === config.itens.length - 1}
                    onClick={() => mover(item, 1)}
                    className={buttonClass("ghost", "h-7 w-7 p-0 disabled:opacity-30")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${titulo} ${local}`}
                    onClick={() => remover(item)}
                    className={buttonClass("ghost", "h-7 w-7 p-0 text-danger hover:bg-danger/10")}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Nenhuma corrida fixada ainda. Escolha estado e cargo acima.
        </p>
      )}
    </div>
  );
}
