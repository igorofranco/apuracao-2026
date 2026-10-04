"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cargosDaUf, isUf, type Cargo } from "@apuracao/shared";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Resolve o cargo ativo de uma página de localidade a partir da query string
 * (`?cargo=`) e expõe a lista de cargos da UF + o seletor que atualiza a URL.
 */
export function useCargoAtivo(uf: string, hrefBase: string) {
  const router = useRouter();
  const search = useSearchParams();
  const cargos = useMemo(() => (isUf(uf) ? cargosDaUf(uf) : []), [uf]);
  const cargoParam = Number(search.get("cargo"));
  const cargoAtivo: Cargo | undefined =
    cargos.find((c) => c.codigo === cargoParam) ?? cargos[0];

  const selecionar = (codigo: number) => {
    router.replace(`${hrefBase}?cargo=${codigo}`);
  };

  return { cargos, cargoAtivo, selecionar };
}

/** Abas de cargo de uma UF. */
export function CargoTabs({
  cargos,
  ativo,
  onSelecionar,
}: {
  cargos: readonly Cargo[];
  ativo?: Cargo;
  onSelecionar: (codigo: number) => void;
}) {
  if (cargos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {cargos.map((c) => (
        <button
          key={c.codigo}
          type="button"
          onClick={() => onSelecionar(c.codigo)}
          className={cn(
            buttonClass("ghost", "px-3 py-1.5"),
            ativo?.codigo === c.codigo &&
              "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {c.curto}
        </button>
      ))}
    </div>
  );
}
