"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { getUf } from "@apuracao/shared";
import { Progress, Segmented, Skeleton } from "@/components/ui";
import {
  MAPA_VIEW,
  useBrasilGeo,
  useBrasilMunicipiosGeo,
  useMunicipiosProjetados,
} from "@/lib/geo";
import {
  COR_NEUTRA,
  agruparMunicipiosPorCor,
  corMapaPresidente,
  percentualEntreDois,
  posicaoAbsoluta,
  posicoesRelativas,
  type CandidatoMapa,
  type EstadoMapa,
  type ModoCores,
  type MunicipioMapa,
} from "@/lib/mapa";
import { formatDateTime, formatInt, formatPercent } from "@/lib/format";
import { useMunicipiosPresidenteBrasil } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Escala = "relativo" | "absoluto";

/** Região pintada no mapa: estado (visão Brasil) ou município (drill-down). */
interface Regiao {
  id: string;
  nome: string;
  votosA: number;
  votosB: number;
}

/**
 * Mapa do Brasil com o heatmap do 2º turno presidencial.
 *
 * Na visão do Brasil inteiro, os municípios aparecem coloridos pela própria
 * votação (sem hover/clique e sem divisas internas); os estados ficam por cima,
 * com borda grossa e clique para abrir a UF. Na UF, o mapa detalhado mantém o
 * hover e a malha municipal completa.
 *
 * - `relativo` (padrão): normaliza entre o extremo mais favorável a A e o mais
 *   favorável a B (do país na visão Brasil; da UF no drill-down).
 * - `absoluto`: usa a diferença real entre os dois candidatos; o empate fica no
 *   centro e só 100% de um candidato chega à ponta.
 */
export function MapaPresidente({
  eleicao,
  estados,
  candidatoA,
  candidatoB,
  carregando = false,
  className,
}: {
  /** Eleição presidencial atual (para o drill-down municipal). */
  eleicao: number;
  /** Votação dos dois candidatos por UF. */
  estados: EstadoMapa[];
  /** Candidato da ponta vermelha (esquerda no espectro). */
  candidatoA: CandidatoMapa;
  /** Candidato da ponta azul (direita no espectro). */
  candidatoB: CandidatoMapa;
  /** Carregando o resumo por estado. */
  carregando?: boolean;
  className?: string;
}) {
  const [escala, setEscala] = useState<Escala>("relativo");
  const [modoCores, setModoCores] = useState<ModoCores>("neutro");
  const [ufSelecionada, setUfSelecionada] = useState<string | null>(null);
  const [focoUf, setFocoUf] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    regiao: Regiao;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pathsEstados = useBrasilGeo();
  const brasilMunicipiosGeo = useBrasilMunicipiosGeo();
  const municipiosGeo = useMunicipiosProjetados(ufSelecionada);
  const municipiosQuery = useMunicipiosPresidenteBrasil({
    eleicao,
    a: candidatoA.numero,
    b: candidatoB.numero,
  });
  const ufInfo = ufSelecionada ? getUf(ufSelecionada) : null;
  const nomeUf =
    ufInfo?.nome ?? (ufSelecionada ? ufSelecionada.toUpperCase() : null);

  /** Votação dos dois candidatos por código IBGE (payload nacional único). */
  const dadosPorCdi = useMemo(() => {
    const mapa = new Map<string, { votosA: number; votosB: number }>();
    for (const [cdi, , votosA, votosB] of
      municipiosQuery.data?.municipios ?? []) {
      mapa.set(cdi, { votosA, votosB });
    }
    return mapa;
  }, [municipiosQuery.data]);

  /* ------------------------- Escala dos estados ------------------------- */

  const estadosRegioes = useMemo<Regiao[]>(
    () =>
      estados.map((e) => ({
        id: e.uf,
        nome: getUf(e.uf)?.nome ?? e.uf.toUpperCase(),
        votosA: e.votosA,
        votosB: e.votosB,
      })),
    [estados],
  );
  const estadosPorId = useMemo(
    () => new Map(estadosRegioes.map((r) => [r.id, r])),
    [estadosRegioes],
  );
  const estadosComVotos = useMemo(
    () => estadosRegioes.filter((r) => r.votosA + r.votosB > 0),
    [estadosRegioes],
  );
  const estadosPosicoes = useMemo(() => {
    if (escala === "absoluto") {
      return new Map(
        estadosComVotos.map((r) => [
          r.id,
          posicaoAbsoluta(r.votosA, r.votosB),
        ]),
      );
    }
    const percentuais = estadosComVotos.map(
      (r) => percentualEntreDois(r.votosA, r.votosB) ?? 0,
    );
    const valores = posicoesRelativas(percentuais);
    return new Map(
      estadosComVotos.map((r, i) => [r.id, valores[i] ?? 0]),
    );
  }, [escala, estadosComVotos]);
  const corEstado = (regiao: Regiao): string => {
    if (regiao.votosA + regiao.votosB <= 0) return COR_NEUTRA;
    return corMapaPresidente(
      estadosPosicoes.get(regiao.id) ?? 0,
      candidatoA.cor,
      candidatoB.cor,
      modoCores,
    );
  };

  /* --------------------- Escala dos municípios (visão) ------------------- */

  const municipiosBrasil = useMemo<MunicipioMapa[]>(
    () =>
      brasilMunicipiosGeo.municipios
        // 38 features vêm com MultiPolygon vazio na fonte: não há o que pintar.
        .filter((m) => m.d)
        .map((m) => {
          const dados = dadosPorCdi.get(m.id);
          return {
            id: m.id,
            d: m.d,
            votosA: dados?.votosA ?? 0,
            votosB: dados?.votosB ?? 0,
          };
        }),
    [brasilMunicipiosGeo.municipios, dadosPorCdi],
  );
  const regioesBrasil = useMemo<Regiao[]>(
    () =>
      municipiosBrasil.map((m) => ({
        id: m.id,
        nome: "",
        votosA: m.votosA,
        votosB: m.votosB,
      })),
    [municipiosBrasil],
  );
  const municipiosComVotos = useMemo(
    () => regioesBrasil.filter((r) => r.votosA + r.votosB > 0),
    [regioesBrasil],
  );
  const regioesUf = useMemo<Regiao[]>(() => {
    if (!ufSelecionada) return [];
    return municipiosGeo.paths.map((municipio) => {
      const dados = dadosPorCdi.get(municipio.id);
      return {
        id: municipio.id,
        nome: municipio.nome,
        votosA: dados?.votosA ?? 0,
        votosB: dados?.votosB ?? 0,
      };
    });
  }, [ufSelecionada, municipiosGeo.paths, dadosPorCdi]);
  const porIdUf = useMemo(
    () => new Map(regioesUf.map((r) => [r.id, r])),
    [regioesUf],
  );

  const usandoMunicipios =
    Boolean(ufSelecionada) || municipiosComVotos.length > 0;
  const regioesEscala = ufSelecionada
    ? regioesUf
    : usandoMunicipios
      ? regioesBrasil
      : estadosRegioes;
  const comVotos = useMemo(
    () => regioesEscala.filter((r) => r.votosA + r.votosB > 0),
    [regioesEscala],
  );
  const temDados = comVotos.length > 0;

  const percentuais = useMemo(
    () => comVotos.map((r) => percentualEntreDois(r.votosA, r.votosB) ?? 0),
    [comVotos],
  );
  const relativas = useMemo(() => {
    const valores = posicoesRelativas(percentuais);
    return new Map(
      comVotos.map((r, i) => [r.id, valores[i] ?? 0]),
    );
  }, [comVotos, percentuais]);

  const minPercentual = percentuais.length ? Math.min(...percentuais) : null;
  const maxPercentual = percentuais.length ? Math.max(...percentuais) : null;

  const posicao = (regiao: Regiao): number =>
    escala === "relativo"
      ? (relativas.get(regiao.id) ?? 0)
      : posicaoAbsoluta(regiao.votosA, regiao.votosB);

  const cor = (regiao: Regiao | undefined): string => {
    if (!regiao || regiao.votosA + regiao.votosB <= 0) return COR_NEUTRA;
    return corMapaPresidente(
      posicao(regiao),
      candidatoA.cor,
      candidatoB.cor,
      modoCores,
    );
  };

  /* --------------------- Camadas municipais do Brasil ------------------- */

  const posicoesBrasil = useMemo(() => {
    if (ufSelecionada) return new Map<string, number>();
    if (escala === "relativo") return relativas;
    return new Map(
      municipiosComVotos.map((r) => [
        r.id,
        posicaoAbsoluta(r.votosA, r.votosB),
      ]),
    );
  }, [ufSelecionada, escala, relativas, municipiosComVotos]);

  const camadasBrasil = useMemo(() => {
    if (ufSelecionada || !brasilMunicipiosGeo.carregado) return [];
    return agruparMunicipiosPorCor(
      municipiosBrasil,
      posicoesBrasil,
      candidatoA.cor,
      candidatoB.cor,
      modoCores,
    );
  }, [
    ufSelecionada,
    brasilMunicipiosGeo.carregado,
    municipiosBrasil,
    posicoesBrasil,
    candidatoA.cor,
    candidatoB.cor,
    modoCores,
  ]);
  const municipiosDesenhados = useMemo(
    () => camadasBrasil.reduce((total, camada) => total + camada.municipios, 0),
    [camadasBrasil],
  );

  const vitoriasA = comVotos.filter((r) => r.votosA > r.votosB).length;
  const vitoriasB = comVotos.filter((r) => r.votosB > r.votosA).length;
  const empates = comVotos.length - vitoriasA - vitoriasB;

  /* -------------------------- Coleta no servidor ------------------------ */

  const coleta = municipiosQuery.data;
  const porUf = ufSelecionada ? coleta?.porUf[ufSelecionada] : undefined;
  const totalColeta = ufSelecionada ? (porUf?.total ?? 0) : (coleta?.total ?? 0);
  const coletadosColeta = ufSelecionada
    ? (porUf?.coletados ?? 0)
    : (coleta?.coletados ?? 0);
  const atualizadoColeta = ufSelecionada
    ? (porUf?.atualizadoEm ?? null)
    : (coleta?.atualizadoEm ?? null);
  const aguardandoLiberacao = coleta?.liberado === false;
  const coletaDesabilitada = Boolean(coleta?.desabilitado);
  const erroColeta = municipiosQuery.isError;
  const coletando = Boolean(
    !aguardandoLiberacao &&
      !coletaDesabilitada &&
      !erroColeta &&
      (coleta?.preparando ||
        (totalColeta > 0 && coletadosColeta < totalColeta)),
  );
  const coletandoSemDados = Boolean(
    ufSelecionada && coletando && !temDados,
  );
  const geometriaCarregando = Boolean(
    ufSelecionada && municipiosGeo.paths.length === 0,
  );
  const carregandoMapa = ufSelecionada ? geometriaCarregando : carregando;
  const progresso =
    totalColeta > 0
      ? Math.min(100, (coletadosColeta / totalColeta) * 100)
      : 0;

  const abrirUf = (uf: string) => {
    setUfSelecionada(uf);
    setFocoUf(null);
    setHover(null);
  };
  const voltarAoBrasil = () => {
    setUfSelecionada(null);
    setFocoUf(null);
    setHover(null);
  };
  const mover = (event: MouseEvent, regiao: Regiao | undefined) => {
    if (!regiao || regiao.votosA + regiao.votosB <= 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    setHover({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      regiao,
    });
  };

  const unidade = usandoMunicipios ? "município" : "estado";
  const local = ufSelecionada ? ` de ${nomeUf}` : "";
  const onde = ufSelecionada ? `de ${nomeUf}` : "do país";

  return (
    <section
      aria-labelledby="mapa-presidente-titulo"
      data-testid="mapa-presidente"
      data-escala={escala}
      data-modo-cores={modoCores}
      data-uf={ufSelecionada ?? ""}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {ufSelecionada ? (
            <nav
              aria-label="Navegação do mapa"
              className="mb-1 flex items-center gap-1.5 text-xs"
            >
              <button
                type="button"
                onClick={voltarAoBrasil}
                className="font-medium text-primary hover:underline"
              >
                Brasil
              </button>
              <span className="text-muted-foreground" aria-hidden>
                /
              </span>
              <span className="font-medium">{nomeUf}</span>
            </nav>
          ) : null}
          <h2
            id="mapa-presidente-titulo"
            className="text-lg font-semibold sm:text-xl"
          >
            Mapa do 2º turno
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {ufSelecionada
              ? `Quem teve mais votos em cada município de ${nomeUf}, na disputa entre ${candidatoA.nomeUrna} e ${candidatoB.nomeUrna}.`
              : `Quem teve mais votos em cada município, na disputa entre ${candidatoA.nomeUrna} e ${candidatoB.nomeUrna}. Clique em um estado para detalhar.`}
          </p>
        </div>
        <Segmented
          value={escala}
          onChange={setEscala}
          label="Escala do mapa"
          options={[
            { value: "relativo", label: "Relativo" },
            { value: "absoluto", label: "Absoluto" },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div ref={containerRef} className="relative mx-auto w-full max-w-[600px]">
          {carregandoMapa ? (
            <Skeleton className="aspect-square w-full rounded-xl" />
          ) : ufSelecionada ? (
            <svg
              data-testid="mapa-municipios"
              data-uf={ufSelecionada}
              viewBox={`0 0 ${MAPA_VIEW} ${MAPA_VIEW}`}
              className="block h-auto w-full"
              role="group"
              aria-label={`Mapa dos municípios de ${nomeUf} na votação do 2º turno`}
            >
              {municipiosGeo.paths.map((municipio) => {
                const regiao = porIdUf.get(municipio.id);
                if (!regiao) return null;
                const pctA = percentualEntreDois(
                  regiao.votosA,
                  regiao.votosB,
                );
                const corRegiao = cor(regiao);
                return (
                  <g
                    key={municipio.id}
                    role="img"
                    aria-label={
                      pctA != null
                        ? `${regiao.nome}: ${candidatoA.nomeUrna} ${formatPercent(
                            pctA,
                            1,
                          )}, ${candidatoB.nomeUrna} ${formatPercent(
                            100 - pctA,
                            1,
                          )}`
                        : `${regiao.nome}: sem dados do 2º turno`
                    }
                    data-testid={`mapa-municipio-${municipio.id}`}
                    data-votos={regiao.votosA + regiao.votosB}
                    onMouseMove={(e) => mover(e, regiao)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {/* Sem divisas internas: o traço usa a mesma cor do fill
                        só para fechar as emendas entre os polígonos. */}
                    <path
                      d={municipio.d}
                      fill={corRegiao}
                      stroke={corRegiao}
                      strokeWidth={0.4}
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
              {municipiosGeo.contorno ? (
                <path
                  data-testid="mapa-uf-contorno"
                  d={municipiosGeo.contorno}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={0.55}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : null}
            </svg>
          ) : (
            <svg
              data-testid="mapa-estados"
              viewBox={`0 0 ${MAPA_VIEW} ${MAPA_VIEW}`}
              className="block h-auto w-full"
              role="group"
              aria-label="Mapa do Brasil com a votação de cada município no 2º turno; os estados são clicáveis para detalhar"
            >
              {/* Base: cor do estado, visível nos municípios ainda sem dados. */}
              <g
                data-testid="mapa-estados-base"
                opacity={municipiosDesenhados > 0 ? 0.55 : 1}
              >
                {pathsEstados.map(({ uf, d }) => {
                  if (!uf) {
                    return (
                      <path
                        key={d.slice(0, 12)}
                        d={d}
                        fill="var(--muted)"
                        stroke="var(--background)"
                        strokeWidth={1.2}
                      />
                    );
                  }
                  const regiao = estadosPorId.get(uf);
                  if (!regiao) return null;
                  return (
                    <path
                      key={uf}
                      data-testid={`mapa-estado-base-${uf}`}
                      d={d}
                      fill={corEstado(regiao)}
                      stroke="var(--background)"
                      strokeWidth={1.2}
                    />
                  );
                })}
              </g>

              {/* Municípios do Brasil: sem hover/clique e sem divisas. */}
              {brasilMunicipiosGeo.carregado ? (
                <g
                  data-testid="mapa-municipios-brasil"
                  data-municipios={municipiosDesenhados}
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  {camadasBrasil.map((camada) => (
                    <path
                      key={camada.cor}
                      d={camada.d}
                      fill={camada.cor}
                      stroke={camada.cor}
                      strokeWidth={0.25}
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              ) : null}

              {/* Bordas dos estados por cima dos municípios + realce do hover. */}
              <g data-testid="mapa-estados-bordas" pointerEvents="none">
                {pathsEstados.map(({ uf, d }) => {
                  if (!uf) return null;
                  const destacado =
                    !ufSelecionada &&
                    (hover?.regiao.id === uf || focoUf === uf);
                  return (
                    <g key={uf}>
                      <path
                        d={d}
                        fill="none"
                        stroke="var(--background)"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                      />
                      {destacado ? (
                        <path
                          d={d}
                          fill="var(--foreground)"
                          fillOpacity={0.06}
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>

              {/* Interação dos estados por cima de tudo: um alvo transparente
                  por UF, sem cobrir as cores dos municípios. */}
              <g data-testid="mapa-estados-interacao">
                {pathsEstados.map(({ uf, d }) => {
                  if (!uf) return null;
                  const regiao = estadosPorId.get(uf);
                  if (!regiao) return null;
                  return (
                    <g
                      key={uf}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver os municípios de ${regiao.nome}`}
                      data-testid={`mapa-estado-${uf}`}
                      data-votos={regiao.votosA + regiao.votosB}
                      className="cursor-pointer focus-visible:outline-none"
                      onClick={() => abrirUf(uf)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirUf(uf);
                        }
                      }}
                      onFocus={() => setFocoUf(uf)}
                      onBlur={() => setFocoUf(null)}
                      onMouseMove={(e) => mover(e, regiao)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <path d={d} fill="transparent" pointerEvents="all" />
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {hover && !carregandoMapa ? (
            <div
              className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
              style={{ left: hover.x, top: hover.y - 10 }}
            >
              <div className="font-semibold">{hover.regiao.nome}</div>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: candidatoA.cor }}
                    />
                    <span className="truncate">{candidatoA.nomeUrna}</span>
                  </span>
                  <span className="tabular font-medium">
                    {formatPercent(
                      percentualEntreDois(
                        hover.regiao.votosA,
                        hover.regiao.votosB,
                      ) ?? 0,
                      1,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: candidatoB.cor }}
                    />
                    <span className="truncate">{candidatoB.nomeUrna}</span>
                  </span>
                  <span className="tabular font-medium">
                    {formatPercent(
                      100 -
                        (percentualEntreDois(
                          hover.regiao.votosA,
                          hover.regiao.votosB,
                        ) ?? 0),
                      1,
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 text-muted-foreground">
                {formatInt(hover.regiao.votosA + hover.regiao.votosB)} votos
              </div>
              {!ufSelecionada ? (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Clique para abrir a UF
                </div>
              ) : null}
            </div>
          ) : null}

          {coletandoSemDados && !carregandoMapa ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-xs rounded-xl border border-border bg-card/95 px-4 py-3 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-medium">Coletando municípios…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {coletadosColeta} de {totalColeta} · roda no servidor, aos
                  poucos
                </p>
              </div>
            </div>
          ) : null}

          {!carregandoMapa &&
          !temDados &&
          !coletando &&
          !coletaDesabilitada &&
          !erroColeta ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                data-testid="mapa-presidente-vazio"
                className="max-w-xs rounded-xl border border-border bg-card/95 px-4 py-3 text-center shadow-sm backdrop-blur"
              >
                <p className="text-sm font-medium">
                  Aguardando a votação do 2º turno
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ufSelecionada
                    ? "O mapa dos municípios é colorido assim que o TSE publicar a apuração."
                    : "O mapa é colorido assim que o TSE publicar a apuração por município."}
                </p>
              </div>
            </div>
          ) : null}

          {!carregandoMapa && !temDados && ufSelecionada && coletaDesabilitada ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-xs rounded-xl border border-border bg-card/95 px-4 py-3 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-medium">
                  Coleta municipal desabilitada
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ative `MUNICIPIOS_POLL` no collector para carregar os
                  municípios.
                </p>
              </div>
            </div>
          ) : null}

          {!carregandoMapa && !temDados && erroColeta ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="max-w-xs rounded-xl border border-border bg-card/95 px-4 py-3 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-medium">
                  Não foi possível carregar os municípios
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  O serviço de coleta pode estar reiniciando; tentando de novo
                  automaticamente.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10"
                style={{ background: candidatoA.cor }}
                aria-hidden
              />
              <span className="min-w-0 truncate font-medium">
                {candidatoA.nomeUrna}
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {candidatoA.siglaPartido} · {candidatoA.numero}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10"
                style={{ background: candidatoB.cor }}
                aria-hidden
              />
              <span className="min-w-0 truncate font-medium">
                {candidatoB.nomeUrna}
              </span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {candidatoB.siglaPartido} · {candidatoB.numero}
              </span>
            </div>
          </div>

          {coletando ? (
            <div
              data-testid="mapa-presidente-coleta"
              className="space-y-1.5 border-t border-border pt-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {coleta?.preparando
                    ? "Preparando a coleta…"
                    : "Coletando municípios"}
                </span>
                <span className="tabular">
                  {totalColeta
                    ? `${coletadosColeta} / ${totalColeta}`
                    : "—"}
                </span>
              </div>
              <Progress
                value={progresso}
                label="Progresso da coleta municipal"
                className="h-1.5"
              />
              <p className="text-[11px] text-muted-foreground">
                O servidor busca os municípios aos poucos; o mapa se completa
                sozinho.
              </p>
            </div>
          ) : null}

          <div
            data-testid="mapa-presidente-legenda"
            className="border-t border-border pt-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Cores
              </span>
              <Segmented
                value={modoCores}
                onChange={setModoCores}
                label="Cores do gradiente do mapa"
                options={[
                  { value: "neutro", label: "Com neutro" },
                  { value: "direto", label: "Sem neutro" },
                ]}
              />
            </div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium">
              <span className="min-w-0 truncate" style={{ color: candidatoB.cor }}>
                {candidatoB.nomeUrna}
              </span>
              {escala === "absoluto" ? (
                <span className="shrink-0 text-muted-foreground">empate</span>
              ) : null}
              <span
                className="ml-auto min-w-0 truncate text-right"
                style={{ color: candidatoA.cor }}
              >
                {candidatoA.nomeUrna}
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full"
              style={{
                background:
                  modoCores === "neutro"
                    ? `linear-gradient(to right, ${candidatoB.cor}, ${COR_NEUTRA}, ${candidatoA.cor})`
                    : `linear-gradient(to right, ${candidatoB.cor}, ${candidatoA.cor})`,
              }}
              aria-hidden
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="tabular">
                {escala === "relativo"
                  ? minPercentual != null
                    ? formatPercent(100 - minPercentual, 1)
                    : "—"
                  : "100%"}
              </span>
              {escala === "absoluto" ? <span>50% × 50%</span> : null}
              <span className="tabular">
                {escala === "relativo"
                  ? maxPercentual != null
                    ? formatPercent(maxPercentual, 1)
                    : "—"
                  : "100%"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {escala === "relativo"
                ? `Cada ${unidade} é comparado com os extremos ${onde}: o mais favorável a ${candidatoA.nomeUrna} fica na ponta vermelha e o mais favorável a ${candidatoB.nomeUrna} na ponta azul.`
                : "A cor segue a diferença real entre os dois candidatos: empate no centro, 100% de um candidato na ponta."}
              {modoCores === "direto"
                ? " O gradiente vai direto do azul ao vermelho, sem cor neutra no meio."
                : null}
            </p>
            {!ufSelecionada && usandoMunicipios ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Municípios ainda sem dados aparecem com a cor do estado.
              </p>
            ) : null}
            {atualizadoColeta ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Dados do TSE de {formatDateTime(atualizadoColeta)}
              </p>
            ) : null}
          </div>

          {temDados ? (
            <p
              data-testid="mapa-presidente-vitorias"
              className="border-t border-border pt-3 text-xs text-muted-foreground"
            >
              {candidatoA.nomeUrna} à frente em{" "}
              <span className="font-semibold text-foreground">{vitoriasA}</span>{" "}
              {unidade}
              {vitoriasA === 1 ? "" : "s"}
              {local} · {candidatoB.nomeUrna} em{" "}
              <span className="font-semibold text-foreground">{vitoriasB}</span>{" "}
              {unidade}
              {vitoriasB === 1 ? "" : "s"}
              {local}
              {empates > 0
                ? ` · ${empates} ${empates === 1 ? "empate" : "empates"}`
                : ""}
            </p>
          ) : (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              {aguardandoLiberacao
                ? "A coleta do 2º turno começa em 25/10 às 16h (Brasília)."
                : coletando
                  ? "Coleta dos municípios em andamento."
                  : coletaDesabilitada
                    ? "Coleta municipal desabilitada no servidor."
                    : erroColeta
                      ? "Não foi possível carregar os municípios agora."
                      : "Nenhum voto computado no 2º turno ainda."}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
