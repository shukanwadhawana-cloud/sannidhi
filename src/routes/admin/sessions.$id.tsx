import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDuration, formatTime } from "@/lib/format";
import { correctAttendance, listLiveAttendance } from "@/lib/server/attendance";
import { listPeople } from "@/lib/server/people";
import { getSession } from "@/lib/server/sessions";
import type { AttendanceRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/sessions/$id")({ component: LiveSession });

function LiveSession() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const session = useQuery({ queryKey: ["session", id], queryFn: () => getSession({ data: id }) });
  const live = useQuery({
    queryKey: ["live", id],
    queryFn: () => listLiveAttendance({ data: id }),
    refetchInterval: 8_000,
  });
  const people = useQuery({ queryKey: ["people"], queryFn: () => listPeople() });

  const rows = useMemo(() => {
    const list = live.data ?? [];
    switch (filter) {
      case "present":
        return list.filter((r) => r.status === "active");
      case "out":
        return list.filter((r) => r.status === "completed");
      case "late":
        return list.filter((r) => r.isLate);
      case "exception":
        return list.filter((r) => r.hasLocationException);
      case "missing":
        return list.filter((r) => r.status === "active" && !r.punchOutTime);
      default:
        return list;
    }
  }, [live.data, filter]);

  const present = (live.data ?? []).filter((r) => r.status === "active").length;

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">Live attendance</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">{session.data?.name ?? "Session"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {session.data?.locationName} · Started {formatTime(session.data?.scheduledStart ?? null)} · Currently present{" "}
        <span className="tabular-nums font-medium text-foreground">{present}</span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["present", "Present"],
            ["out", "Checked out"],
            ["late", "Late"],
            ["exception", "Location exception"],
            ["missing", "Missing punch-out"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-medium",
              filter === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <CorrectForm
        sessionId={id}
        people={people.data ?? []}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["live", id] });
          void qc.invalidateQueries({ queryKey: ["admin-overview"] });
        }}
      />

      <div className="mt-4 md:hidden">
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{row.userName ?? "Satsangi"}</p>
                  <StatusBadge row={row} />
                </div>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  In {formatTime(row.punchInTime)}
                  {row.punchOutTime ? ` · Out ${formatTime(row.punchOutTime)}` : ""}
                  {row.durationSeconds ? ` · ${formatDuration(row.durationSeconds)}` : ""}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Entry</th>
              <th className="py-2 font-medium">Exit</th>
              <th className="py-2 font-medium">Duration</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-3 font-medium">{row.userName ?? "Satsangi"}</td>
                <td className="tabular-nums">{formatTime(row.punchInTime)}</td>
                <td className="tabular-nums">{formatTime(row.punchOutTime)}</td>
                <td className="tabular-nums">{formatDuration(row.durationSeconds)}</td>
                <td>
                  <StatusBadge row={row} />
                </td>
                <td className="tabular-nums text-muted-foreground">
                  {row.punchInDistance != null ? `${Math.round(row.punchInDistance)} m` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="mt-6 text-sm text-muted-foreground">No matching attendance yet.</p> : null}
    </div>
  );
}

function StatusBadge({ row }: { row: AttendanceRecord }) {
  if (row.hasLocationException) return <Badge tone="warn">Exception</Badge>;
  if (row.isLate && row.status === "active") return <Badge tone="warn">Late</Badge>;
  if (row.status === "active") return <Badge tone="ok">Present</Badge>;
  return <Badge>Completed</Badge>;
}

function CorrectForm({
  sessionId,
  people,
  onSaved,
}: {
  sessionId: string;
  people: Array<{ userId: string; fullName: string }>;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [punchInTime, setPunchInTime] = useState("");
  const [punchOutTime, setPunchOutTime] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () =>
      correctAttendance({
        data: {
          userId,
          sessionId,
          punchInTime: punchInTime ? new Date(punchInTime).toISOString() : null,
          punchOutTime: punchOutTime ? new Date(punchOutTime).toISOString() : null,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Correction recorded.");
      setOpen(false);
      setReason("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6">
      {open ? (
        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold">Manual correction</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this for forgotten punches, GPS failure, or dead phones. A reason is required and
            written to the audit log. History is never overwritten silently.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Satsangi" htmlFor="c-user">
              <Select id="c-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose…</option>
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reason" htmlFor="c-reason">
              <Input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
            <Field label="Entry" htmlFor="c-in">
              <Input id="c-in" type="datetime-local" value={punchInTime} onChange={(e) => setPunchInTime(e.target.value)} />
            </Field>
            <Field label="Exit" htmlFor="c-out">
              <Input id="c-out" type="datetime-local" value={punchOutTime} onChange={(e) => setPunchOutTime(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save correction"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          Correct attendance
        </Button>
      )}
    </div>
  );
}
