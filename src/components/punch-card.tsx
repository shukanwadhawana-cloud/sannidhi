import { MapPin, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PunchClock } from "@/components/punch-clock";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { formatDateLong, formatTime } from "@/lib/format";
import { humanGeoError, readLocation } from "@/lib/geolocation";
import { punchIn, punchOut } from "@/lib/server/punch";
import type { HomeData, PunchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type LocState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; text: string }
  | { kind: "warn"; text: string }
  | { kind: "err"; text: string };

export function PunchCard({
  data,
  onChanged,
}: {
  data: HomeData;
  onChanged: () => void;
}) {
  const { session, attendance } = data;
  const [loc, setLoc] = useState<LocState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [offerException, setOfferException] = useState(false);
  const [pendingAction, setPendingAction] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function runPunch(action: "in" | "out", forceException = false) {
    if (!session) return;
    if (!online) {
      toast.error("An internet connection is required to record attendance.");
      return;
    }
    setBusy(true);
    setLoc({ kind: "checking" });
    setOfferException(false);
    try {
      let fix: { latitude: number | null; longitude: number | null; accuracy: number | null } = {
        latitude: null,
        longitude: null,
        accuracy: null,
      };
      try {
        const g = await readLocation();
        fix = { latitude: g.latitude, longitude: g.longitude, accuracy: g.accuracy };
        setLoc({ kind: "ok", text: "Location received. Recording attendance…" });
      } catch (error) {
        const mapped = humanGeoError(error);
        setLoc({ kind: "warn", text: mapped.message });
        if (!forceException) {
          setOfferException(true);
          setPendingAction(action);
          setBusy(false);
          return;
        }
      }

      const payload = {
        sessionId: session.id,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        clientTime: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        forceException,
      };
      const result: PunchResult = action === "in" ? await punchIn({ data: payload }) : await punchOut({ data: payload });
      if (!result.ok) {
        setLoc({ kind: result.canRetryWithException ? "warn" : "err", text: result.message });
        if (result.canRetryWithException) {
          setOfferException(true);
          setPendingAction(action);
        }
        return;
      }
      setLoc({
        kind: "ok",
        text: result.exception
          ? "Recorded with a location exception."
          : "You appear to be at the Sabha.",
      });
      toast.success(action === "in" ? "You’re checked in." : "Attendance completed.");
      onChanged();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      if (message === "Unauthorized") {
        toast.error("Please sign in again.");
        return;
      }
      if (!online || message.toLowerCase().includes("fetch")) {
        toast.error("An internet connection is required to record attendance.");
        return;
      }
      setLoc({ kind: "err", text: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden p-6">
      <PunchClock
        session={session}
        attendance={attendance}
        busy={busy}
        online={online}
        onPunch={(action) => void runPunch(action)}
      />

      {session ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium text-muted-foreground">Today’s Sabha</p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">{session.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateLong(session.sessionDate)}</p>
          <p className="text-sm text-muted-foreground">
            {formatTime(session.scheduledStart)} – {formatTime(session.scheduledEnd)}
          </p>
          <p className="mt-3 flex items-start gap-2 text-sm text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {session.locationName}
              {session.locationAddress ? ` · ${session.locationAddress}` : ""}
            </span>
          </p>
          {data.policy.graceMinutes > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Arrival grace {data.policy.graceMinutes} minutes after start.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 border-t border-border pt-5">
          <h2 className="font-display text-xl font-semibold">No active Sabha right now</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            When a coordinator opens a session, tap the clock to punch in.
          </p>
        </div>
      )}

      <div
        className={cn(
          "mt-5 rounded-lg px-3 py-3 text-sm",
          loc.kind === "ok" && "bg-primary/10 text-primary",
          loc.kind === "warn" && "bg-[color-mix(in_oklab,var(--color-warn)_14%,white)] text-warn",
          loc.kind === "err" && "bg-destructive/10 text-destructive",
          (loc.kind === "idle" || loc.kind === "checking") && "bg-secondary text-secondary-foreground",
        )}
        role="status"
        aria-live="polite"
      >
        {loc.kind === "checking" ? (
          <span className="inline-flex items-center gap-2">
            <Radio className="size-4 animate-pulse" /> Checking location…
          </span>
        ) : loc.kind === "idle" ? (
          "Location is only requested when you punch in or out."
        ) : (
          loc.text
        )}
      </div>

      {!online ? (
        <p className="mt-3 text-sm text-destructive">
          An internet connection is required to record attendance.
        </p>
      ) : null}

      {attendance?.hasLocationException ? (
        <div className="mt-3">
          <Badge tone="warn">Location exception</Badge>
        </div>
      ) : null}

      {offerException ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm leading-relaxed text-foreground">
            We couldn’t confirm you’re inside the Sabha area. You can still record attendance as a
            location exception. A coordinator will see this flag.
          </p>
          <Button
            className="mt-3 w-full"
            variant="outline"
            disabled={busy}
            onClick={() => void runPunch(pendingAction ?? "in", true)}
          >
            Record with location exception
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
