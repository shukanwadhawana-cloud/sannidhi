import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleHelp,
  ClipboardList,
  LogOut,
  Shield,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { Badge, Card } from "@/components/ui/card";
import { signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { firstName, roleLabel } from "@/lib/format";
import { isAdmin, isStaff } from "@/lib/roles";
import { getMyProfile } from "@/lib/server/profile";
import { getHomeData } from "@/lib/server/punch";

export const Route = createFileRoute("/more")({ component: MorePage });

type MoreTo =
  | "/regularize"
  | "/leave"
  | "/history"
  | "/admin"
  | "/admin/approvals"
  | "/team"
  | "/admin/policy"
  | "/profile"
  | "/help"
  | "/privacy";

function MorePage() {
  const { user, isPending } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const home = useQuery({
    queryKey: ["home"],
    queryFn: () => getHomeData(),
    enabled: Boolean(user),
  });

  if (isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;

  const p = profile.data;
  const staff = p ? isStaff(p.role) : false;
  const admin = p ? isAdmin(p.role) : false;
  const pending = home.data?.pendingRequestCount ?? 0;

  return (
    <AppShell profile={p}>
      <p className="text-sm font-medium text-muted-foreground">Account & tools</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">More</h1>
      {p ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {firstName(p.fullName)} · {roleLabel(p.role)}
        </p>
      ) : null}

      <Section title="Attendance">
        <Tile
          to="/regularize"
          icon={ClipboardList}
          label="Regularize attendance"
          desc="Forgot a punch? Ask a coordinator to correct it."
          badge={pending > 0 ? `${pending} pending` : undefined}
        />
        <Tile
          to="/leave"
          icon={CalendarClock}
          label="Leave / not attending"
          desc="Mark a day away or a Sabha you will miss."
        />
        <Tile to="/history" icon={CalendarClock} label="Month calendar" desc="Present, leave, and missed days." />
      </Section>

      {staff ? (
        <Section title="Sabha desk">
          <Tile to="/admin" icon={Shield} label="Coordinator desk" desc="Live KPIs, sessions, and people." />
          <Tile
            to="/admin/approvals"
            icon={ClipboardList}
            label="Approvals"
            desc="Regularization and leave requests."
          />
          <Tile to="/team" icon={Users} label="My team" desc="Who is in the hall right now." />
          {admin ? (
            <Tile to="/admin/policy" icon={SlidersHorizontal} label="Org policy" desc="Grace minutes and hall rules." />
          ) : null}
        </Section>
      ) : null}

      <Section title="Account">
        <Tile to="/profile" icon={UserRound} label="Your details" desc="Name, mobile, member ID." />
        <Tile to="/help" icon={CircleHelp} label="Help centre" desc="Punch-in, GPS, leave, and roles." />
        <Tile to="/privacy" icon={CircleHelp} label="Privacy" desc="What location we keep, and why." />
      </Section>

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted-foreground">
          Sign out to switch accounts on this device.
        </p>
        <button
          type="button"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/8 text-sm font-medium text-destructive"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </Card>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  desc,
  badge,
}: {
  to: MoreTo;
  icon: typeof UserRound;
  label: string;
  desc: string;
  badge?: string;
}) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-3.5 active:bg-secondary/60">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {badge ? <Badge tone="warn">{badge}</Badge> : null}
          </span>
          <span className="block text-xs text-muted-foreground">{desc}</span>
        </span>
        <span className="text-muted-foreground">›</span>
      </Link>
    </li>
  );
}
