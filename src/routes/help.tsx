import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/server/profile";

export const Route = createFileRoute("/help")({ component: HelpPage });

const FAQS: { q: string; a: string; cat: string }[] = [
  {
    cat: "Punch",
    q: "How does punch-in work?",
    a: "Open Today and tap the clock. Your browser asks for location once. The server stamps the time — not your phone clock — and measures distance to the Sabha hall. Stay connected; offline punches are refused on purpose.",
  },
  {
    cat: "Punch",
    q: "The clock is live but Punch in is disabled.",
    a: "There is no open Sabha session. Coordinators open a session with a punch-in window. When one is live, the clock becomes the punch button.",
  },
  {
    cat: "Location",
    q: "GPS failed or I’m just outside the fence.",
    a: "If the session allows it, you can still record a location exception. Coordinators see that flag on the live roster. There is no background tracking — location is requested only when you punch.",
  },
  {
    cat: "Location",
    q: "Why does accuracy matter?",
    a: "If GPS is fuzzy, Sannidhi still lets you in when the accuracy circle overlaps the hall radius. Very poor accuracy may need an exception.",
  },
  {
    cat: "Regularize",
    q: "I forgot to punch. What now?",
    a: "Open More → Regularize. Choose the Sabha, enter the times you were actually there, and send a reason. A coordinator approves it before it counts as attendance.",
  },
  {
    cat: "Leave",
    q: "How do I mark that I will not attend?",
    a: "More → Leave. Choose a full day away, or a specific Sabha you will miss. Until a coordinator approves it, the calendar still treats the day as open.",
  },
  {
    cat: "Team",
    q: "What is My Team?",
    a: "Coordinators see a live roster of who is in the hall, who has completed attendance, who is on leave, and location exceptions. It refreshes every few seconds.",
  },
  {
    cat: "Policy",
    q: "What is arrival grace?",
    a: "Administrators set grace minutes on the Policy desk. Arrivals within that window after scheduled start are not marked late.",
  },
  {
    cat: "Account",
    q: "Who is the first administrator?",
    a: "The first person to sign in becomes super administrator. Later accounts start as satsangis and can be promoted under Desk → People.",
  },
];

function HelpPage() {
  const { user } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const [open, setOpen] = useState<number | null>(0);
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...Array.from(new Set(FAQS.map((f) => f.cat)))];
  const list = filter === "All" ? FAQS : FAQS.filter((f) => f.cat === filter);

  return (
    <AppShell profile={profile.data}>
      <p className="text-sm font-medium text-muted-foreground">
        <Link to="/more" className="underline-offset-4 hover:underline">
          More
        </Link>
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Help centre</h1>
      <p className="mt-1 text-sm text-muted-foreground">Punch-in, GPS, leave, and coordinator tools.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`h-10 rounded-full px-3 text-sm font-medium ${
              filter === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link to="/regularize" className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Regularize</p>
          <p className="mt-1 text-xs text-muted-foreground">Missed a punch? Request a correction.</p>
        </Link>
        <Link to="/leave" className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Leave</p>
          <p className="mt-1 text-xs text-muted-foreground">Mark a day away or a missed Sabha.</p>
        </Link>
        <Link to="/privacy" className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Privacy</p>
          <p className="mt-1 text-xs text-muted-foreground">Location is only taken at punch time.</p>
        </Link>
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 font-semibold">Frequently asked</div>
        <div className="divide-y divide-border">
          {list.map((item) => {
            const i = FAQS.indexOf(item);
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-12 w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="mr-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {item.cat}
                    </span>
                    <span className="text-sm font-medium">{item.q}</span>
                  </span>
                  <span className="text-muted-foreground">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen ? (
                  <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
