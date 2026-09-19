import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDuration, formatTime, roleLabel } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { getTeamRoster } from "@/lib/server/desk";
import { getMyProfile } from "@/lib/server/profile";
import type { TeamMember } from "@/lib/types";

export const Route = createFileRoute("/team")({ component: TeamPage });

function statusTone(status: TeamMember["status"]) {
  if (status === "present") return "ok" as const;
  if (status === "completed") return "neutral" as const;
  if (status === "exception") return "warn" as const;
  if (status === "leave") return "neutral" as const;
  return "danger" as const;
}

function statusLabel(status: TeamMember["status"]) {
  switch (status) {
    case "present":
      return "In hall";
    case "completed":
      return "Completed";
    case "exception":
      return "Exception";
    case "leave":
      return "Leave";
    default:
      return "Not in";
  }
}

function TeamPage() {
  const { user, isPending } = useCurrentUserState();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const roster = useQuery({
    queryKey: ["team-roster"],
    queryFn: () => getTeamRoster(),
    enabled: Boolean(user) && Boolean(profile.data && isStaff(profile.data.role)),
    refetchInterval: 8_000,
  });

  const members = useMemo(() => {
    const list = roster.data?.members ?? [];
    return list.filter((m) => {
      const hay = `${m.profile.fullName} ${m.profile.email ?? ""} ${m.profile.memberId ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (filter !== "all" && m.status !== filter) return false;
      return true;
    });
  }, [roster.data, q, filter]);

  if (isPending || profile.isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;
  if (!profile.data || !isStaff(profile.data.role)) {
    return (
      <AppShell profile={profile.data}>
        <Card className="p-6">My Team is for coordinators.</Card>
      </AppShell>
    );
  }

  const c = roster.data?.counts;

  return (
    <AppShell profile={profile.data}>
      <p className="text-sm font-medium text-muted-foreground">Live roster</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">My team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {roster.data?.session
          ? `${roster.data.session.name} · ${roster.data.session.locationName}`
          : "No open Sabha — showing people and approved leave."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="In hall" value={c?.present ?? "—"} />
        <Stat label="Completed" value={c?.completed ?? "—"} />
        <Stat label="Not in" value={c?.notIn ?? "—"} />
        <Stat label="Leave" value={c?.leave ?? "—"} />
        <Stat label="Exceptions" value={c?.exceptions ?? "—"} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or member ID"
          aria-label="Search team"
        />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="present">In hall</option>
          <option value="completed">Completed</option>
          <option value="not_in">Not in</option>
          <option value="leave">Leave</option>
          <option value="exception">Exception</option>
        </Select>
      </div>

      <ul className="mt-5 grid gap-2">
        {members.length ? (
          members.map((m) => (
            <li key={m.profile.userId}>
              <Card className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.profile.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleLabel(m.profile.role)}
                    {m.punchInTime ? ` · in ${formatTime(m.punchInTime)}` : ""}
                    {m.punchOutTime ? ` – ${formatTime(m.punchOutTime)}` : ""}
                    {m.durationSeconds ? ` · ${formatDuration(m.durationSeconds)}` : ""}
                  </p>
                </div>
                <Badge tone={statusTone(m.status)}>{statusLabel(m.status)}</Badge>
              </Card>
            </li>
          ))
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">No people match that filter.</Card>
        )}
      </ul>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </Card>
  );
}
