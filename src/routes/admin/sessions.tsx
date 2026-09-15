import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDate, formatTime, isoToIstInput, istInputToIso, ymdInZone } from "@/lib/format";
import { listLocations } from "@/lib/server/locations";
import { listSessions, saveSession } from "@/lib/server/sessions";
import type { SabhaSession } from "@/lib/types";

export const Route = createFileRoute("/admin/sessions")({ component: SessionsPage });

function SessionsPage() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listSessions() });
  const locations = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const [open, setOpen] = useState(false);
  const today = ymdInZone();
  const [form, setForm] = useState({
    locationId: "",
    name: "Sunday Morning Sabha",
    date: today,
    start: "08:00",
    end: "10:30",
    punchOpen: "07:30",
    punchClose: "08:30",
    allowLocationExceptions: true,
    allowOutOfGeofencePunchOut: true,
  });

  const save = useMutation({
    mutationFn: () =>
      saveSession({
        data: {
          locationId: form.locationId || locations.data?.[0]?.id || "",
          name: form.name,
          sessionDate: form.date,
          scheduledStart: istInputToIso(form.date, form.start),
          scheduledEnd: istInputToIso(form.date, form.end),
          punchInOpenTime: istInputToIso(form.date, form.punchOpen),
          punchInCloseTime: istInputToIso(form.date, form.punchClose),
          allowLocationExceptions: form.allowLocationExceptions,
          allowOutOfGeofencePunchOut: form.allowOutOfGeofencePunchOut,
          status: "open",
        },
      }),
    onSuccess: () => {
      toast.success("Session saved.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["sessions"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Date, hall, and punch-in window.</p>
        </div>
        <Button onClick={() => setOpen(true)}>New session</Button>
      </div>

      {open ? (
        <Card className="mt-5 p-5">
          <h2 className="font-display text-xl font-semibold">New Sabha session</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Name" htmlFor="s-name">
              <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Location" htmlFor="s-loc">
              <Select
                id="s-loc"
                value={form.locationId || locations.data?.[0]?.id || ""}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="s-date">
              <Input id="s-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Start" htmlFor="s-start">
              <Input id="s-start" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </Field>
            <Field label="End" htmlFor="s-end">
              <Input id="s-end" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </Field>
            <Field label="Punch-in opens" htmlFor="s-open">
              <Input id="s-open" type="time" value={form.punchOpen} onChange={(e) => setForm({ ...form, punchOpen: e.target.value })} />
            </Field>
            <Field label="Punch-in closes" htmlFor="s-close">
              <Input id="s-close" type="time" value={form.punchClose} onChange={(e) => setForm({ ...form, punchClose: e.target.value })} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowLocationExceptions}
              onChange={(e) => setForm({ ...form, allowLocationExceptions: e.target.checked })}
            />
            Allow punch-in with a location exception when GPS fails
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowOutOfGeofencePunchOut}
              onChange={(e) => setForm({ ...form, allowOutOfGeofencePunchOut: e.target.checked })}
            />
            Allow punch-out outside the geofence (flagged)
          </label>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save session"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <ul className="mt-5 grid gap-2">
        {sessions.data?.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </ul>
    </div>
  );
}

function SessionRow({ session }: { session: SabhaSession }) {
  const start = isoToIstInput(session.scheduledStart);
  return (
    <Link to="/admin/sessions/$id" params={{ id: session.id }}>
      <Card className="px-4 py-4 transition-colors hover:bg-secondary/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{session.name}</p>
            <p className="text-sm text-muted-foreground">{session.locationName}</p>
          </div>
          <Badge>{session.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(session.sessionDate)} · {formatTime(session.scheduledStart)} – {formatTime(session.scheduledEnd)}
          <span className="sr-only">{start.date}</span>
        </p>
      </Card>
    </Link>
  );
}
