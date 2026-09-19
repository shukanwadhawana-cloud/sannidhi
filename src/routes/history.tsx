import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { MonthCalendar } from "@/components/month-calendar";
import { Badge, Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { shiftMonth } from "@/lib/calendar";
import { formatDate, formatDuration, formatTime, ymdInZone } from "@/lib/format";
import { listMyHistory } from "@/lib/server/attendance";
import { getMonthDesk } from "@/lib/server/desk";
import { getMyProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const { user, isPending } = useCurrentUserState();
  const [status, setStatus] = useState("all");
  const today = ymdInZone();
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const desk = useQuery({
    queryKey: ["month-desk", cursor.year, cursor.month],
    queryFn: () => getMonthDesk({ data: cursor }),
    enabled: Boolean(user),
  });
  const history = useQuery({
    queryKey: ["history", status],
    queryFn: () => listMyHistory({ data: { status } }),
    enabled: Boolean(user),
  });

  if (isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell profile={profile.data}>
      <h1 className="font-display text-3xl font-semibold">Attendance history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Calendar of your Sabha visits, leave, and missed days.</p>

      <Card className="mt-5 p-4">
        {desk.data ? (
          <MonthCalendar
            desk={desk.data}
            busy={desk.isFetching}
            onShift={(delta) => setCursor((c) => shiftMonth(c.year, c.month, delta))}
          />
        ) : (
          <div className="h-64 animate-pulse rounded-lg bg-secondary" />
        )}
        {desk.data ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {desk.data.summary.presentDays} present · {desk.data.summary.leaveDays} leave ·{" "}
            {desk.data.summary.absentDays} absent · {desk.data.summary.sabhaDays} Sabha days
          </p>
        ) : null}
      </Card>

      <div className="mt-6 max-w-xs">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="active">Still attending</option>
          <option value="exception">Location exceptions</option>
        </Select>
      </div>
      <ul className="mt-5 grid gap-2">
        {history.data?.length ? (
          history.data.map((row) => (
            <li key={row.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.sessionName}</p>
                    <p className="text-sm text-muted-foreground">{row.locationName}</p>
                  </div>
                  <Badge tone={row.hasLocationException ? "warn" : "ok"}>
                    {row.status === "active" ? "Attending" : "Present"}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>{formatDate(row.sessionDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Entry</dt>
                    <dd className="tabular-nums">{formatTime(row.punchInTime)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Exit</dt>
                    <dd className="tabular-nums">{formatTime(row.punchOutTime)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="tabular-nums">{formatDuration(row.durationSeconds)}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">No attendance recorded yet.</Card>
        )}
      </ul>
    </AppShell>
  );
}