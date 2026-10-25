"use client";

import { useMemo } from "react";
import { UFS } from "@apuracao/shared";
import type { CandidateResult } from "@apuracao/domain";
import { useEleicoes, useResumo, useResultado } from "@/lib/queries";
import { dataPresidencial } from "@/lib/eleicoes";
import { PresidenteSegundoTurno } from "@/components/presidente-segundo-turno";
import { MapaPresidente } from "@/components/mapa-presidente";
import { Card } from "@/components/ui";
import { corPartido, getPartido, type Espectro } from "@/lib/partidos";
import { disputaPresidencialComFallback } from "@/lib/segundo-turno";

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
    // No mobile a home é uma tela só: placar + mapa presidencial, sem scroll.
    // (O `-my-6` cancela o padding vertical do <main> e o footer é ocultado
    // pelo CSS quando este container está presente.)
    <div
      data-mobile-home
      className="space-y-8 max-sm:flex max-sm:h-svh max-sm:flex-col max-sm:gap-3 max-sm:space-y-0 max-sm:-my-6 max-sm:py-2"
    >
      {resumo.isError ? (
        <Card className="p-4 text-sm text-muted-foreground max-sm:hidden">
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
      />

      {/* Heatmap do 2º turno por estado (logo abaixo dos presidentes) */}
      {mapaPresidente ? (
        <MapaPresidente
          eleicao={eleicoes.federal.cd}
          estados={mapaPresidente.estados}
          candidatoA={mapaPresidente.candidatoA}
          candidatoB={mapaPresidente.candidatoB}
          carregando={resumo.isLoading}
        />
      ) : null}
    </div>
  );
}
