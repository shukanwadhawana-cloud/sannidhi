import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { getAdminOverview } from "@/lib/server/attendance";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchInterval: 8_000,
  });
  const d = overview.data;

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">Today</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Sabha desk</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Sabha sessions" value={d?.todaySessions ?? "—"} />
        <Stat label="Checked in" value={d?.checkedIn ?? "—"} />
        <Stat label="Checked out" value={d?.checkedOut ?? "—"} />
        <Stat label="Currently present" value={d?.currentlyPresent ?? "—"} />
        <Stat label="Location exceptions" value={d?.locationExceptions ?? "—"} />
        <Stat label="Late arrivals" value={d?.lateArrivals ?? "—"} />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold">Active sessions</h2>
      <ul className="mt-3 grid gap-2">
        {d?.sessions.length ? (
          d.sessions.map(({ session, present, completed, exceptions }) => (
            <li key={session.id}>
              <Link to="/admin/sessions/$id" params={{ id: session.id }}>
                <Card className="px-4 py-4 transition-colors hover:bg-secondary/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(session.scheduledStart)} – {formatTime(session.scheduledEnd)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.locationName}</p>
                  <p className="mt-2 text-sm tabular-nums text-foreground">
                    {present} present · {completed} completed · {exceptions}{" "}
                    {exceptions === 1 ? "exception" : "exceptions"}
                  </p>
                </Card>
              </Link>
            </li>
          ))
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            No sessions dated today. Create one under Sessions.
          </Card>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
    </Card>
  );
}
