import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { LiveBadge } from "@/components/live-badge";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

/**
 * Cabeçalho padrão das páginas de apuração: trilha de navegação, título com
 * selo opcional, subtítulo e o badge "ao vivo".
 */
export function RaceHeader({
  crumbs = [],
  title,
  badge,
  subtitle,
}: {
  crumbs?: Crumb[];
  title: ReactNode;
  badge?: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i > 0 ? <span>/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        ) : null}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <LiveBadge />
    </section>
  );
}
