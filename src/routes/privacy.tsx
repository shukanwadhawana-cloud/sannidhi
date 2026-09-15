import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Privacy</h1>
      <div className="mt-5 max-w-prose space-y-4 text-sm leading-relaxed text-foreground">
        <p>
          Sannidhi collects the least location data needed to verify that a satsangi is at a Sabha.
        </p>
        <p>
          <strong>Why.</strong> Attendance is only trusted when someone is physically at the hall.
          GPS is used to measure distance from the Sabha marker, not to follow anyone.
        </p>
        <p>
          <strong>When.</strong> Location is requested only when you punch in, punch out, or tap to
          verify. There is no background tracking.
        </p>
        <p>
          <strong>What is stored.</strong> For each punch: server time, coordinates, GPS accuracy,
          and distance from the Sabha. Device user-agent is stored as supporting metadata.
        </p>
        <p>
          <strong>Who can see it.</strong> You can see your own history. Coordinators and
          administrators of your organisation can see attendance for sessions they manage, including
          location exceptions.
        </p>
        <p>
          <strong>How long.</strong> Location fields on attendance events are retained for 365 days
          by default, then eligible for deletion. Attendance presence (who came, entry/exit times)
          may be kept longer for organisational records.
        </p>
        <p>
          Browser timestamps are never treated as the official time. The server clock is.
        </p>
        <p>
          <Link to="/" className="underline underline-offset-4">
            Back to today
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
