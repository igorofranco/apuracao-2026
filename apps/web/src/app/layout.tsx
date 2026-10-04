import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Apuração 2026 — Eleições em tempo real",
  description:
    "Acompanhamento em tempo real da apuração das Eleições Gerais de 2026, com dados oficiais do TSE.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 text-xs text-muted-foreground">
            <p>
              Dados públicos e oficiais do TSE (resultados.tse.jus.br), verificados por
              assinatura digital. Este é um projeto independente e não tem vínculo com o
              Tribunal Superior Eleitoral.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
