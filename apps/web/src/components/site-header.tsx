"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Moon, Sun, Vote } from "lucide-react";
import { LiveBadge } from "@/components/live-badge";
import { buttonClass } from "@/components/ui";
import { TEMA_CHAVE } from "@/lib/tema";

export function SiteHeader() {
  // O tema inicial é aplicado pelo script inline do layout (antes do primeiro
  // paint). Aqui só reagimos à troca do sistema quando não há escolha salva.
  useEffect(() => {
    const sistema = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = (evento: MediaQueryListEvent) => {
      if (localStorage.getItem(TEMA_CHAVE) == null) {
        document.documentElement.classList.toggle("dark", evento.matches);
      }
    };
    sistema.addEventListener("change", aoMudar);
    return () => sistema.removeEventListener("change", aoMudar);
  }, []);

  const alternarTema = () => {
    const escuro = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem(TEMA_CHAVE, escuro ? "dark" : "light");
    } catch {
      // Sem armazenamento a escolha vale só nesta visita.
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          aria-label="Apuração 2026 — início"
          className="flex items-center gap-2 font-semibold"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Vote className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Apuração 2026</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1 text-sm">
          <Link href="/" className={buttonClass("ghost", "px-2 py-1")}>
            Painel
          </Link>
          <Link href="/presidente" className={buttonClass("ghost", "px-2 py-1")}>
            Presidente
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <LiveBadge />
          </span>
          <button
            type="button"
            onClick={alternarTema}
            aria-label="Alternar tema"
            className={buttonClass("outline", "h-8 w-8 p-0")}
          >
            {/* Os dois ícones ficam no DOM: o CSS escolhe conforme a classe
                `.dark` do <html>, sem depender de estado/hidratação. */}
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </button>
        </div>
      </div>
    </header>
  );
}
