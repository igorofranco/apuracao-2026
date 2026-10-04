"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun, Vote } from "lucide-react";
import { LiveBadge } from "@/components/live-badge";
import { buttonClass } from "@/components/ui";

export function SiteHeader() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("apuracao-theme");
    const prefersDark =
      stored === "dark" ||
      (stored == null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("apuracao-theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
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
          <LiveBadge className="hidden sm:inline-flex" />
          <button
            type="button"
            onClick={toggle}
            aria-label="Alternar tema"
            className={buttonClass("outline", "h-8 w-8 p-0")}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
