"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Settings2, Sparkles } from "lucide-react";
import type { RaceSummary } from "@apuracao/domain";
import { useResumo } from "@/lib/queries";
import { buttonClass } from "@/components/ui";
import { PainelEditor } from "@/components/painel-editor";
import { RaceMiniCard } from "@/components/race-mini-card";
import { chaveCorrida, usePainel, type CorridaFixada } from "@/lib/painel";

/** Atalhos prontos para começar rápido (espelham o caso de uso mais comum). */
const PRESETS: { label: string; descricao: string; itens: CorridaFixada[] }[] = [
  {
    label: "Presidência",
    descricao: "Só a disputa nacional",
    itens: [{ cargo: 1, uf: "br" }],
  },
  {
    label: "MG (majoritários)",
    descricao: "Presidente + Governador + Senador de MG",
    itens: [
      { cargo: 1, uf: "br" },
      { cargo: 3, uf: "mg" },
      { cargo: 5, uf: "mg" },
    ],
  },
  {
    label: "SP (majoritários)",
    descricao: "Presidente + Governador + Senador de SP",
    itens: [
      { cargo: 1, uf: "br" },
      { cargo: 3, uf: "sp" },
      { cargo: 5, uf: "sp" },
    ],
  },
];

/**
 * Seção personalizável do painel inicial: o usuário escolhe quais corridas
 * acompanhar de perto. Fica **recolhida** por padrão — o botão "Painel
 * personalizado" revela o conteúdo. A preferência fica no `localStorage`
 * (sem backend); o recolhimento é volátil (não persiste).
 */
export function MeuPainel() {
  const { pronto, config, adicionar, adicionarVarias, remover, mover, setTopN, limpar } =
    usePainel();
  const resumo = useResumo();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const resumoPorChave = useMemo(() => {
    const mapa = new Map<string, RaceSummary>();
    for (const corrida of resumo.data?.corridas ?? []) {
      mapa.set(`${corrida.cargo}:${corrida.uf}`, corrida);
    }
    return mapa;
  }, [resumo.data]);

  if (!pronto) {
    return <div className="h-9 w-52 animate-pulse rounded-lg bg-muted" aria-hidden />;
  }

  const vazio = config.itens.length === 0;
  const mostrarEditor = aberto && (editando || vazio);

  // Recolhido: apenas o botão que revela o painel.
  if (!aberto) {
    return (
      <section aria-label="Meu painel">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setAberto(true)}
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/50"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold">Painel personalizado</span>
            <span className="truncate text-xs text-muted-foreground">
              {vazio
                ? "acompanhe as corridas que você escolher"
                : `${config.itens.length} corrida${config.itens.length > 1 ? "s" : ""} · top ${config.topN} de cada`}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="meu-painel-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="meu-painel-titulo" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Meu painel
          </h2>
          <p className="text-sm text-muted-foreground">
            {vazio
              ? "Escolha as corridas que você quer acompanhar de perto."
              : `${config.itens.length} corrida${config.itens.length > 1 ? "s" : ""} · top ${config.topN} de cada`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!vazio ? (
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className={buttonClass("outline", "gap-1.5 whitespace-nowrap")}
            >
              {editando ? (
                <>
                  <Settings2 className="h-4 w-4" />
                  Concluir
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Editar painel
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            aria-expanded={true}
            onClick={() => {
              setAberto(false);
              setEditando(false);
            }}
            className={buttonClass("ghost", "gap-1.5 whitespace-nowrap")}
          >
            <ChevronUp className="h-4 w-4" />
            Ocultar
          </button>
        </div>
      </div>

      {mostrarEditor ? (
        <PainelEditor
          config={config}
          adicionar={adicionar}
          remover={remover}
          mover={mover}
          setTopN={setTopN}
          limpar={limpar}
        />
      ) : null}

      {vazio ? (
        !mostrarEditor || config.itens.length === 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Começar com um atalho
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => adicionarVarias(preset.itens)}
                  className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-left transition hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="break-words text-sm font-semibold">{preset.label}</div>
                  <div className="mt-0.5 break-words text-xs text-muted-foreground">
                    {preset.descricao}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {config.itens.map((corrida) => (
            <RaceMiniCard
              key={chaveCorrida(corrida)}
              corrida={corrida}
              topN={config.topN}
              resumo={resumoPorChave.get(chaveCorrida(corrida))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
