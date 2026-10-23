import Link from "next/link";
import type { CandidateResult, RaceResult } from "@apuracao/domain";
import { FotoCandidato } from "@/components/foto-candidato";
import { LiveBadge } from "@/components/live-badge";
import { NumeroBadge } from "@/components/numero-badge";
import { Progress, Skeleton } from "@/components/ui";
import { formatCompact, formatData, formatDateTime, formatInt, formatPercent } from "@/lib/format";
import { disputaPresidencial, type OrigemDisputa } from "@/lib/segundo-turno";
import { cn } from "@/lib/utils";

const ORIGEM_TEXTO: Record<OrigemDisputa, string> = {
  oficial: "Disputa de 2º turno confirmada pelo TSE",
  matematico: "2º turno definido pela apuração",
  apuracao: "Os dois mais votados até agora",
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
  carregando = false,
  mostrarLink = true,
  className,
}: {
  race: RaceResult | undefined;
  /** Turno atual da disputa presidencial (2 quando já é o 2º turno). */
  turno: number;
  /** Data da eleição (ISO). */
  data?: string | null;
  carregando?: boolean;
  mostrarLink?: boolean;
  className?: string;
}) {
  const disputa = disputaPresidencial(race);
  const dois = disputa?.candidatos ?? [];
  const totalizadas = race?.secoes.percentualTotalizadas ?? 0;
  const segundoTurno = turno > 1;
  const lider = dois[0] ?? null;
  // Antes da votação os dois candidatos existem, mas ninguém está "na frente".
  const temVotos = dois.some((c) => c.votos > 0);

  return (
    <section
      aria-labelledby="presidencia-titulo"
      data-testid="presidente-segundo-turno"
      data-turno={turno}
      className={cn(
        "flex flex-col justify-center rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8",
        "min-h-[calc(100svh-8rem)] lg:min-h-[calc(100svh-11rem)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-info/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-info">
              {segundoTurno ? "2º turno" : "Apuração presidencial"}
              {data ? <span className="font-normal">· {formatData(data)}</span> : null}
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              Eleições Gerais 2026
            </span>
            <LiveBadge className="ml-auto sm:hidden" />
          </div>
          <h1
            id="presidencia-titulo"
            className="mt-2 text-2xl font-bold sm:text-4xl"
          >
            Disputa presidencial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Brasil · </span>
            {disputa
              ? ORIGEM_TEXTO[disputa.origem]
              : "aguardando a definição dos dois candidatos"}
            {race?.atualizadoEm ? (
              <span className="hidden sm:inline">
                {" "}
                · atualizado {formatDateTime(race.atualizadoEm)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <div className="tabular text-3xl font-bold leading-none sm:text-5xl">
            {formatPercent(totalizadas, 1)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            das seções totalizadas
          </div>
          {race ? (
            <div className="mt-1 hidden text-xs text-muted-foreground sm:block">
              {formatCompact(race.votos.validos)} votos válidos
            </div>
          ) : null}
        </div>
      </div>

      <Progress
        value={totalizadas}
        label="Seções totalizadas da disputa presidencial"
        className="mt-4 h-2.5 sm:mt-5"
      />

      <div className="mt-4 grid flex-1 items-stretch gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2">
        {carregando ? (
          <>
            <Skeleton className="min-h-[13rem] w-full rounded-2xl" />
            <Skeleton className="min-h-[13rem] w-full rounded-2xl" />
          </>
        ) : dois.length === 2 ? (
          dois.map((candidato, i) => (
            <CandidatoDestaque
              key={candidato.numero + candidato.nome}
              candidato={candidato}
              lider={temVotos && i === 0}
            />
          ))
        ) : (
          <div className="self-center rounded-2xl border border-dashed border-border p-6 text-center sm:col-span-2">
            <p className="text-base font-medium">
              Aguardando o início da apuração do 2º turno
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lider
                ? "O segundo candidato do 2º turno ainda não está definido."
                : "Os dois candidatos aparecem aqui assim que o TSE publicar os dados."}
            </p>
          </div>
        )}
      </div>

      {disputa && race ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:mt-7">
          <span>
            {segundoTurno
              ? "2º turno: Presidente da República"
              : "Projeção atualizada conforme a apuração"}
          </span>
          {mostrarLink ? (
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
  // Antes da votação não há percentual: melhor "—" do que "0,0%".
  const semVotos = candidato.votos <= 0;
  return (
    <article
      data-testid="candidato-destaque"
      data-posicao={candidato.posicao}
      className={cn(
        "flex min-w-0 flex-col justify-center rounded-2xl border p-4 sm:p-6",
        lider
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-background/40",
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <FotoCandidato
          sqcand={candidato.sqcand}
          nome={candidato.nomeUrna}
          numero={candidato.numero}
          className="h-24 w-[4.25rem] rounded-xl sm:h-32 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <NumeroBadge numero={candidato.numero} destaque tamanho="md" />
            <span className="text-xs font-semibold">{candidato.siglaPartido}</span>
            {lider ? (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                1º lugar
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 min-w-0 break-words text-xl font-bold leading-tight sm:text-2xl">
            {candidato.nomeUrna}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{candidato.nome}</p>
          {candidato.coligacao ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {candidato.coligacao}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 sm:mt-5">
        <div>
          <div className="tabular text-4xl font-bold leading-none sm:text-5xl">
            {semVotos ? "—" : formatPercent(pct, 1)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            dos votos válidos
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-lg font-semibold sm:text-xl">
            {semVotos ? "—" : formatInt(candidato.votos)}
          </div>
          <div className="text-xs text-muted-foreground">votos</div>
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            lider ? "bg-primary" : "bg-primary/45",
          )}
          style={{ width: `${semVotos ? 0 : Math.max(pct, 1)}%` }}
        />
      </div>

      {candidato.vice ? (
        <p className="mt-4 truncate text-xs text-muted-foreground">
          Vice: <span className="text-foreground/80">{candidato.vice}</span>
        </p>
      ) : null}
    </article>
  );
}
