import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_0_rgba(28,43,36,0.04),0_12px_32px_rgba(28,43,36,0.05)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground",
    ok: "bg-primary/12 text-primary",
    warn: "bg-[color-mix(in_oklab,var(--color-warn)_16%,white)] text-warn",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
