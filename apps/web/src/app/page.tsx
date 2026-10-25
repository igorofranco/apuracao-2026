"use client";

import { useMemo } from "react";
import { UFS } from "@apuracao/shared";
import type { CandidateResult } from "@apuracao/domain";
import { useEleicoes, useGrafico, useResumo, useResultado } from "@/lib/queries";
import { dataPresidencial } from "@/lib/eleicoes";
import { PresidenteSegundoTurno } from "@/components/presidente-segundo-turno";
import { MapaPresidente } from "@/components/mapa-presidente";
import { Card } from "@/components/ui";
import { corPartido, getPartido, type Espectro } from "@/lib/partidos";
import { disputaPresidencialComFallback } from "@/lib/segundo-turno";
import { cn } from "@/lib/utils";

/** Ordem usada para escolher as pontas do gradiente (esquerda → direita). */
const ORDEM_ESPECTRO: Espectro[] = [
  "esquerda",
  "centro-esquerda",
  "centro",
  "centro-direita",
  "direita",
];

function pesoEspectro(candidato: CandidateResult): number {
  const espectro = getPartido(candidato.siglaPartido)?.espectro;
  const indice = espectro ? ORDEM_ESPECTRO.indexOf(espectro) : -1;
  return indice >= 0 ? indice : ORDEM_ESPECTRO.indexOf("centro");
}

export default function HomePage() {
  const eleicoes = useEleicoes();
  const resumo = useResumo();
  const presidente = useResultado({
    eleicao: eleicoes.federal.cd,
    cargo: 1,
    uf: "br",
  });
  // Dispara junto com o resultado (não espera os candidatos): o gráfico já
  // chega pronto do collector, que cacheia o payload recortado.
  const grafico = useGrafico({
    eleicao: eleicoes.federal.cd,
    cargo: 1,
    uf: "br",
  });

  const corridas = resumo.data?.corridas ?? [];

  // Presidente por UF: o /api/resumo já traz a votação dos principais
  // candidatos de cada corrida, sem precisar de 27 requisições de resultado.
  const presidentePorUf = useMemo(() => {
    const m = new Map<string, (typeof corridas)[number]>();
    for (const c of corridas) {
      if (
        c.cargo === 1 &&
        c.eleicao === eleicoes.federal.cd &&
        c.uf.toLowerCase() !== "br"
      ) {
        m.set(c.uf.toLowerCase(), c);
      }
    }
    return m;
  }, [corridas, eleicoes.federal.cd]);

  const mapaPresidente = useMemo(() => {
    // No 2º turno, usa a dupla conhecida mesmo antes de o TSE publicar a
    // corrida; o mapa fica no estado de espera até chegar a apuração.
    const disputa = disputaPresidencialComFallback(
      presidente.data,
      eleicoes.federal.turno,
    );
    if (!disputa || disputa.candidatos.length < 2) return null;

    // A ponta vermelha é o candidato mais à esquerda; a azul, o mais à direita.
    const [a, b] = [...disputa.candidatos].sort(
      (x, y) => pesoEspectro(x) - pesoEspectro(y),
    ) as [CandidateResult, CandidateResult];

    const estados = UFS.map((u) => {
      const resumo = presidentePorUf.get(u.uf);
      const votos = (numero: string) =>
        resumo?.candidatos?.find((c) => c.numero === numero)?.votos ?? 0;
      return { uf: u.uf, votosA: votos(a.numero), votosB: votos(b.numero) };
    });

    return {
      candidatoA: {
        numero: a.numero,
        nomeUrna: a.nomeUrna,
        siglaPartido: a.siglaPartido,
        cor: corPartido(a.siglaPartido),
      },
      candidatoB: {
        numero: b.numero,
        nomeUrna: b.nomeUrna,
        siglaPartido: b.siglaPartido,
        cor: corPartido(b.siglaPartido),
      },
      estados,
    };
  }, [presidente.data, presidentePorUf, eleicoes.federal.turno]);

  return (
    // A home inteira cabe na viewport, sem scroll, em qualquer orientação:
    // - paisagem (lado maior horizontal): placar e mapa lado a lado;
    // - retrato (lado maior vertical): placar acima, mapa abaixo.
    // O CSS de `[data-home]` remove o padding do <main> e oculta o rodapé.
    <div
      data-home
      className="relative flex h-full min-h-0 w-full flex-col gap-2 p-2 sm:gap-3 sm:p-3 paisagem:flex-row paisagem:gap-4 paisagem:p-4 micro:gap-2 micro:p-2"
    >
      {resumo.isError ? (
        <Card className="absolute left-1/2 top-2 z-20 w-[min(42rem,calc(100%-1rem))] -translate-x-1/2 p-3 text-sm text-muted-foreground shadow-lg">
          Não foi possível carregar os dados do TSE agora. O serviço de coleta pode estar
          reiniciando — os números aparecem assim que a conexão for restabelecida.
        </Card>
      ) : null}

      {/* 2º turno: só os dois candidatos, em evidência */}
      <PresidenteSegundoTurno
        race={presidente.data}
        turno={eleicoes.federal.turno}
        data={dataPresidencial(eleicoes)}
        mostrarLink={false}
        className={cn(
          "retrato:shrink-0 paisagem:min-h-0",
          // Sem mapa (antes da disputa existir), o placar ocupa a tela toda.
          mapaPresidente
            ? "retrato:flex-none paisagem:w-[38%] paisagem:min-w-[19rem] paisagem:max-w-[44rem]"
            : "flex-1",
        )}
      />

      {/* Heatmap do 2º turno por estado (ao lado em paisagem) */}
      {mapaPresidente ? (
        <MapaPresidente
          eleicao={eleicoes.federal.cd}
          estados={mapaPresidente.estados}
          candidatoA={mapaPresidente.candidatoA}
          candidatoB={mapaPresidente.candidatoB}
          carregando={resumo.isLoading}
          evolucao={grafico.data}
          evolucaoCarregando={grafico.isLoading}
          evolucaoErro={grafico.isError}
          className="min-h-0 min-w-0 flex-1"
        />
      ) : null}
    </div>
  );
}
