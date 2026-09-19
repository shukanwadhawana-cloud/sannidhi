import { formatClockParts, formatDuration, formatTime } from "@/lib/format";
import type { AttendanceRecord, SabhaSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function Ring({ progress, tone }: { progress: number; tone: "idle" | "in" | "done" }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = Math.max(0.8, p * c);
  const color =
    tone === "in" ? "text-primary" : tone === "done" ? "text-ok" : "text-primary/45";
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        className="text-secondary"
        stroke="currentColor"
        strokeWidth="3.6"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        className={color}
        stroke="currentColor"
        strokeWidth="3.6"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PunchClock({
  session,
  attendance,
  busy,
  online,
  onPunch,
}: {
  session: SabhaSession | null;
  attendance: AttendanceRecord | null;
  busy: boolean;
  online: boolean;
  onPunch: (action: "in" | "out") => void;
}) {
  const now = useNow();
  const clock = formatClockParts(now);
  const checkedIn = attendance?.status === "active";
  const completed = attendance?.status === "completed";
  const elapsed = checkedIn && attendance?.punchInTime
    ? Math.max(0, Math.round((now.getTime() - new Date(attendance.punchInTime).getTime()) / 1000))
    : attendance?.durationSeconds ?? 0;

  let progress = now.getSeconds() / 60;
  let tone: "idle" | "in" | "done" = "idle";
  if (checkedIn && session) {
    tone = "in";
    const start = new Date(session.scheduledStart).getTime();
    const end = new Date(session.scheduledEnd).getTime();
    progress = end > start ? (now.getTime() - start) / (end - start) : 0;
  } else if (completed) {
    tone = "done";
    progress = 1;
  }

  const canIn = Boolean(session) && !checkedIn && !completed && online && !busy;
  const canOut = Boolean(session) && checkedIn && online && !busy;
  const disabled = completed || !session || busy || !online;

  let actionLabel = "Punch in";
  if (busy) actionLabel = checkedIn ? "Recording…" : "Checking in…";
  else if (completed) actionLabel = "Completed";
  else if (checkedIn) actionLabel = "Punch out";
  else if (!session) actionLabel = "No Sabha";
  else if (!online) actionLabel = "Offline";

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-medium text-muted-foreground">{clock.dateLabel}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPunch(checkedIn ? "out" : "in")}
        aria-label={actionLabel}
        data-state={tone}
        className={cn(
          "punch-clock-face relative mt-5 grid size-56 place-items-center rounded-full bg-card text-foreground",
          canIn || canOut ? "cursor-pointer" : "cursor-default",
        )}
      >
        <Ring progress={progress} tone={tone} />
        <span className="relative z-10 flex flex-col items-center px-6">
          <span className="font-display text-5xl font-semibold tabular-nums leading-none tracking-tight">
            {clock.hour}:{clock.minute}
          </span>
          <span className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {clock.second} · {clock.dayPeriod} IST
          </span>
          <span
            className={cn(
              "mt-3 rounded-full px-3 py-1 text-sm font-semibold",
              checkedIn && "bg-primary/12 text-primary",
              completed && "bg-primary/12 text-primary",
              !checkedIn && !completed && "bg-secondary text-secondary-foreground",
            )}
          >
            {actionLabel}
          </span>
        </span>
      </button>

      {checkedIn ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Attending · {formatDuration(elapsed)}
          {attendance?.punchInTime ? ` · in at ${formatTime(attendance.punchInTime)}` : ""}
        </p>
      ) : completed && attendance ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {formatTime(attendance.punchInTime)} – {formatTime(attendance.punchOutTime)} ·{" "}
          {formatDuration(attendance.durationSeconds)}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {session ? "Tap the clock to punch in." : "The clock is live. Punch-in appears when Sabha opens."}
        </p>
      )}
    </div>
  );
}
