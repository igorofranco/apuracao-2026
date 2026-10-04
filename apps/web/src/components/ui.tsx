import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Card ---------------------------------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------- Badge ---------------------------------- */

type BadgeVariant = "default" | "outline" | "success" | "accent" | "danger" | "muted";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-primary/15 text-primary border-primary/30",
  outline: "bg-transparent text-foreground border-border",
  success: "bg-success/15 text-success border-success/30",
  accent: "bg-accent/20 text-accent-foreground border-accent/40 dark:text-accent",
  danger: "bg-danger/15 text-danger border-danger/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "ghost" | "outline" | "muted";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  muted: "bg-muted text-foreground hover:bg-muted/70",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    buttonVariants[variant],
    className,
  );
}

/* -------------------------------- Progress -------------------------------- */

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/* ---------------------------------- Stat ---------------------------------- */

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
