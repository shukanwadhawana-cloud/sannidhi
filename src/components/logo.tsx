import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DiyaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-primary", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.12" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M16 8.2c1.6 2.2 2.4 3.8 2.4 5.2 0 1.4-1.1 2.6-2.4 2.6s-2.4-1.2-2.4-2.6c0-1.4.8-3 2.4-5.2Z"
        fill="currentColor"
      />
      <path
        d="M8.5 20.4c2.2 2.6 4.6 3.8 7.5 3.8s5.3-1.2 7.5-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <DiyaMark className="size-8" />
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</div>
        {compact ? null : (
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Sabha attendance
          </div>
        )}
      </div>
    </div>
  );
}
