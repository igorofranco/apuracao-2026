"use client";

import { useState } from "react";
import { fotoCandidato } from "@/lib/foto";
import { cn } from "@/lib/utils";

/**
 * Retrato oficial do candidato (TSE). Quando a foto não existe — candidato sem
 * `sqcand`, arquivo não publicado ou falha de rede — cai para o número em um
 * bloco neutro, sem quebrar o layout.
 */
export function FotoCandidato({
  sqcand,
  nome,
  numero,
  className,
}: {
  sqcand: string | null;
  nome: string;
  numero: string;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const src = fotoCandidato(sqcand);

  if (!src || falhou) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground",
          className,
        )}
      >
        {numero}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Foto de ${nome}`}
      width={161}
      height={225}
      data-testid="foto-candidato"
      onError={() => setFalhou(true)}
      className={cn("shrink-0 bg-muted object-cover object-top", className)}
    />
  );
}
