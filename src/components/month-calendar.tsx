import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayMarkLabel } from "@/lib/calendar";
import type { CalendarDay, MonthDesk } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function markClass(mark: CalendarDay["mark"], inMonth: boolean) {
  if (!inMonth) return "text-muted-foreground/40";
  switch (mark) {
    case "present":
      return "bg-primary text-primary-foreground";
    case "leave":
      return "bg-secondary text-foreground";
    case "not_attending":
      return "bg-secondary text-muted-foreground";
    case "absent":
      return "bg-[color-mix(in_oklab,var(--color-warn)_18%,white)] text-warn";
    case "open":
      return "ring-2 ring-primary text-primary";
    default:
      return "text-foreground";
  }
}

export function MonthCalendar({
  desk,
  onShift,
  busy,
}: {
  desk: MonthDesk;
  onShift: (delta: number) => void;
  busy?: boolean;
}) {
  const title = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(desk.year, desk.month - 1, 1)));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-md text-foreground hover:bg-secondary"
          onClick={() => onShift(-1)}
          aria-label="Previous month"
          disabled={busy}
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-md text-foreground hover:bg-secondary"
          onClick={() => onShift(1)}
          aria-label="Next month"
          disabled={busy}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {desk.days.map((day) => {
          const n = Number(day.date.slice(8, 10));
          return (
            <div
              key={day.date + String(day.inMonth)}
              title={`${day.date} · ${dayMarkLabel(day.mark)}`}
              className={cn(
                "grid aspect-square place-items-center rounded-md text-sm tabular-nums",
                markClass(day.mark, day.inMonth),
              )}
            >
              {n}
            </div>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" /> Present
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[color-mix(in_oklab,var(--color-warn)_50%,white)]" /> Absent
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-secondary ring-1 ring-border" /> Leave
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full ring-2 ring-primary" /> Today
        </li>
      </ul>
    </div>
  );
}
