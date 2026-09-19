import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthScreen } from "@/components/auth-screen";
import { BrandedSplash } from "@/components/branded-splash";
import { PunchCard } from "@/components/punch-card";
import { Badge, Card } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { firstName, formatDate, formatDuration, formatTime, greetingFor } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { getHomeData } from "@/lib/server/punch";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const home = useQuery({
    queryKey: ["home"],
    queryFn: () => getHomeData(),
    enabled: Boolean(user),
    refetchInterval: 20_000,
  });

  if (isPending) return <BrandedSplash />;
  if (!user) return <AuthScreen />;

  const data = home.data;
  const profile = data?.profile;

  return (
    <AppShell profile={profile}>
      <p className="text-sm font-medium text-muted-foreground">{greetingFor()}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
        {firstName(profile?.fullName ?? user.displayName)}
      </h1>

      <div className="mt-6">
        {home.isLoading ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Loading today’s Sabha…</p>
            <div className="mx-auto mt-6 size-56 animate-pulse rounded-full bg-secondary" />
          </Card>
        ) : home.error ? (
          <Card className="p-6 text-sm text-destructive">
            Could not load today’s Sabha. Please refresh.
          </Card>
        ) : data ? (
          <PunchCard data={data} onChanged={() => void home.refetch()} />
        ) : null}
      </div>

      {data ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniStat label="This month" value={data.month.presentDays} hint="present days" />
          <MiniStat label="Sabha days" value={data.month.sabhaDays} hint="this month" />
          <MiniStat label="Leave" value={data.month.leaveDays} hint="approved" />
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Quick to="/regularize" icon={ClipboardList} label="Regularize" />
        <Quick to="/leave" icon={CalendarClock} label="Leave" />
        {profile && isStaff(profile.role) ? (
          <Quick to="/team" icon={Users} label="My team" />
        ) : (
          <Quick to="/history" icon={CalendarClock} label="Calendar" />
        )}
      </div>

      {data?.recent.length ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Recent attendance</h2>
            <Link to="/history" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <ul className="grid gap-2">
            {data.recent.slice(0, 4).map((row) => (
              <li key={row.id}>
                <Card className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{row.sessionName ?? "Sabha"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(row.sessionDate ?? row.punchInTime)} · {formatTime(row.punchInTime)}
                      {row.punchOutTime ? ` – ${formatTime(row.punchOutTime)}` : ""}
                      {row.durationSeconds ? ` · ${formatDuration(row.durationSeconds)}` : ""}
                    </p>
                  </div>
                  <Badge tone={row.hasLocationException ? "warn" : row.status === "active" ? "ok" : "neutral"}>
                    {row.status === "active" ? "Attending" : row.hasLocationException ? "Exception" : "Present"}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Quick({
  to,
  icon: Icon,
  label,
}: {
  to: "/regularize" | "/leave" | "/team" | "/history";
  icon: typeof ClipboardList;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-2 text-center text-xs font-medium text-foreground"
    >
      <Icon className="size-4 text-primary" />
      {label}
    </Link>
  );
}