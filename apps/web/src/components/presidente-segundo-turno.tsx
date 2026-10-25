import Link from "next/link";
import type { CandidateResult, RaceResult } from "@apuracao/domain";
import { FotoCandidato } from "@/components/foto-candidato";
import { LiveBadge } from "@/components/live-badge";
import { NumeroBadge } from "@/components/numero-badge";
import { Progress, Skeleton } from "@/components/ui";
import { formatCompact, formatData, formatInt, formatPercent } from "@/lib/format";
import {
  disputaPresidencialComFallback,
  type OrigemDisputa,
} from "@/lib/segundo-turno";
import { cn } from "@/lib/utils";

const ORIGEM_TEXTO: Record<OrigemDisputa, string> = {
  oficial: "Disputa de 2º turno confirmada pelo TSE",
  matematico: "2º turno definido pela apuração",
  apuracao: "Os dois mais votados até agora",
  aguardando: "Aguardando o início da apuração do 2º turno",
};

/**
 * Destaque da disputa presidencial no 2º turno: ocupa a primeira seção do site e
 * mostra apenas os dois candidatos, com votação e percentual em tamanho grande.
 * Funciona igualmente quando o TSE ainda não publicou a eleição do 2º turno —
 * nesse caso usa a projeção (marca oficial, matemática ou os dois mais votados).
 */
export function PresidenteSegundoTurno({
  race,
  turno,
  data,
  mostrarLink = true,
  className,
}: {
  race: RaceResult | undefined;
  /** Turno atual da disputa presidencial (2 quando já é o 2º turno). */
  turno: number;
  /** Data da eleição (ISO). */
  data?: string | null;
  mostrarLink?: boolean;
  className?: string;
}) {
  const disputa = disputaPresidencialComFallback(race, turno);
  const dois = disputa?.candidatos ?? [];
  const totalizadas = race?.secoes.percentualTotalizadas ?? 0;
  const segundoTurno = turno > 1;
  // Antes da votação os dois candidatos existem, mas ninguém está "na frente".
  const temVotos = dois.some((c) => c.votos > 0);

  return (
    <section
      aria-labelledby="presidencia-titulo"
      data-testid="presidente-segundo-turno"
      data-turno={turno}
      className={cn(
        // Placar em tela cheia: ocupa toda a altura disponível no desktop e o
        // bloco superior no retrato. O conteúdo é compacto de propósito para
        // dividir a viewport com o mapa, sem scroll.
        "@container flex min-h-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4 micro:p-2",
        "paisagem:justify-start",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-info/40 bg-info/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-info sm:text-xs">
              {segundoTurno ? "2º turno" : "Apuração presidencial"}
              {data ? <span className="font-normal">· {formatData(data)}</span> : null}
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground @xl:inline">
              Eleições Gerais 2026
            </span>
            <LiveBadge className="ml-auto" />
          </div>
          <h1
            id="presidencia-titulo"
            className="mt-1.5 text-lg font-bold leading-tight @md:text-xl @xl:text-2xl"
          >
            Disputa presidencial
          </h1>
          <p className="mt-0.5 line-clamp-1 hidden text-xs text-muted-foreground retrato:block @md:block @md:text-sm curta:hidden">
            {disputa
              ? ORIGEM_TEXTO[disputa.origem]
              : "aguardando os dados do 2º turno"}
          </p>
        </div>

        <div className="flex items-baseline gap-1.5 max-sm:mt-1 max-sm:w-full sm:block sm:text-right">
          <div className="tabular text-2xl font-bold leading-none @md:text-3xl @xl:text-4xl">
            {formatPercent(totalizadas, 1)}
          </div>
          <div className="text-[11px] text-muted-foreground sm:mt-1 @lg:text-xs micro:hidden">
            das seções totalizadas
          </div>
          {race && race.votos.validos > 0 ? (
            <div className="mt-1 hidden text-xs text-muted-foreground paisagem-alta:block">
              {formatCompact(race.votos.validos)} votos válidos
            </div>
          ) : null}
        </div>
      </div>

      <Progress
        value={totalizadas}
        label="Seções totalizadas da disputa presidencial"
        className="mt-2 h-1.5 shrink-0 sm:mt-3 sm:h-2 micro:mt-1 micro:h-1"
      />

      <div
        className={cn(
          "mt-3 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:gap-3 micro:mt-2 micro:gap-1.5",
          // Retrato: os dois candidatos em uma faixa lado a lado (a partir de
          // tablet). Paisagem: empilhados, dividindo a altura do placar.
          "retrato:sm:grid-cols-2",
          "paisagem:grid-cols-1 paisagem:grid-rows-2 paisagem:gap-3",
        )}
      >
        {dois.length === 2 ? (
          dois.map((candidato, i) => (
            <CandidatoDestaque
              key={candidato.numero + candidato.nome}
              candidato={candidato}
              lider={temVotos && i === 0}
            />
          ))
        ) : (
          <>
            <PlaceholderCandidato />
            <PlaceholderCandidato />
          </>
        )}
      </div>

      {disputa ? (
        <div className="mt-3 hidden shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground paisagem-alta:flex">
          <span>
            {segundoTurno
              ? "2º turno: Presidente da República"
              : "Projeção atualizada conforme a apuração"}
          </span>
          {mostrarLink && !segundoTurno ? (
            <Link
              href="/presidente"
              className="font-medium text-primary hover:underline"
            >
              Ver apuração completa →
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Cartão de um dos dois candidatos do 2º turno. */
function CandidatoDestaque({
  candidato,
  lider,
}: {
  candidato: CandidateResult;
  lider: boolean;
}) {
  const pct = Math.max(0, Math.min(100, candidato.percentual));
  return (
    <article
      data-testid="candidato-destaque"
      data-posicao={candidato.posicao}
      className={cn(
        // Uma linha por candidato: foto, identificação e números. O tamanho
        // acompanha a largura do próprio cartão (container query).
        "@container flex min-w-0 flex-col justify-center rounded-xl border p-2.5 sm:rounded-2xl sm:p-4 micro:p-1.5",
        lider
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-background/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 @md:gap-4 micro:gap-1.5">
        <FotoCandidato
          sqcand={candidato.sqcand}
          nome={candidato.nomeUrna}
          numero={candidato.numero}
          className="h-14 w-10 shrink-0 rounded-md @xs:h-20 @xs:w-14 @md:h-24 @md:w-[4.25rem] @xl:h-32 @xl:w-24 @md:rounded-lg baixa:h-10 baixa:w-7 micro:h-9 micro:w-6"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 @md:gap-x-2 @md:gap-y-1">
            <NumeroBadge
              numero={candidato.numero}
              destaque
              tamanho="md"
              className="h-5 min-w-5 px-1 text-[10px] @md:h-auto @md:min-w-0 @md:text-xs"
            />
            <span className="text-[10px] font-semibold @md:text-xs">
              {candidato.siglaPartido}
            </span>
            {lider ? (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground @md:px-2 @md:text-[10px] micro:hidden">
                1º lugar
              </span>
            ) : null}
          </div>
          <h2 className="mt-0.5 break-words text-sm font-bold leading-tight @xs:text-base @md:mt-1.5 @md:text-lg @xl:text-2xl">
            {candidato.nomeUrna}
          </h2>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground @md:text-sm curta:hidden micro:hidden">
            {candidato.nome}
          </p>
          {candidato.coligacao ? (
            <p className="mt-0.5 hidden truncate text-xs text-muted-foreground @xl:block">
              {candidato.coligacao}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <div className="tabular text-xl font-bold leading-none @xs:text-2xl @md:text-3xl @xl:text-4xl">
            {formatPercent(pct)}
          </div>
          <div className="mt-0.5 hidden text-[11px] text-muted-foreground @md:block">
            dos votos válidos
          </div>
          <div className="tabular mt-0.5 text-xs font-semibold @md:mt-1.5 @md:text-base">
            {formatInt(candidato.votos)}
          </div>
          <div className="text-[10px] text-muted-foreground @md:text-xs">votos</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted @md:mt-3 @md:h-2 baixa:hidden micro:hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            lider ? "bg-primary" : "bg-primary/45",
          )}
          style={{ width: `${pct > 0 ? Math.max(pct, 1) : 0}%` }}
        />
      </div>

      {candidato.vice ? (
        <p className="mt-3 hidden truncate text-xs text-muted-foreground @md:block">
          Vice: <span className="text-foreground/80">{candidato.vice}</span>
        </p>
      ) : null}
    </article>
  );
}

/**
 * Enquanto o TSE não publica os candidatos/votação do 2º turno, o espaço de
 * cada candidato fica reservado com um placeholder — sem reaproveitar dados do
 * 1º turno.
 */
function PlaceholderCandidato() {
  return (
    <div
      data-testid="candidato-placeholder"
      aria-hidden
      className="flex min-h-0 items-center gap-2.5 rounded-xl border border-dashed border-border p-2.5 sm:gap-4 sm:rounded-2xl sm:p-4"
    >
      <Skeleton className="h-14 w-10 shrink-0 rounded-md sm:h-24 sm:w-[4.25rem] sm:rounded-lg xl:h-32 xl:w-24 baixa:h-10 baixa:w-7" />
      <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="hidden h-4 w-1/2 sm:block" />
      </div>
      <div className="shrink-0 space-y-1.5">
        <Skeleton className="h-8 w-20 sm:h-10 sm:w-28" />
        <Skeleton className="h-3 w-16 sm:w-20" />
      </div>
    </div>
  );
}
