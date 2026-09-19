import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BrandedSplash } from "@/components/branded-splash";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDate, requestStatusLabel, requestTypeLabel, ymdInZone } from "@/lib/format";
import { getMyProfile } from "@/lib/server/profile";
import { cancelMyRequest, createAttendanceRequest, listMyRequests, listRequestSessions } from "@/lib/server/requests";

export const Route = createFileRoute("/leave")({ component: LeavePage });

function LeavePage() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const sessions = useQuery({
    queryKey: ["request-sessions"],
    queryFn: () => listRequestSessions(),
    enabled: Boolean(user),
  });
  const mine = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => listMyRequests(),
    enabled: Boolean(user),
  });

  const [kind, setKind] = useState<"leave" | "not_attending">("leave");
  const [dayDate, setDayDate] = useState(ymdInZone());
  const [sessionId, setSessionId] = useState("");
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      createAttendanceRequest({
        data: {
          requestType: kind,
          sessionId: kind === "not_attending" ? sessionId : null,
          dayDate,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Request sent.");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["my-requests"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => cancelMyRequest({ data: id }),
    onSuccess: () => {
      toast.success("Request withdrawn.");
      void qc.invalidateQueries({ queryKey: ["my-requests"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <BrandedSplash />;
  if (!user) return <RedirectToSignIn />;

  const rows = mine.data?.filter((r) => r.requestType === "leave" || r.requestType === "not_attending") ?? [];

  return (
    <AppShell profile={profile.data}>
      <p className="text-sm font-medium text-muted-foreground">
        <Link to="/more" className="underline-offset-4 hover:underline">
          More
        </Link>
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Leave</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mark a full day away, or tell coordinators you will miss a specific Sabha.
      </p>

      <Card className="mt-6 p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <Field label="Type" htmlFor="kind">
            <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as "leave" | "not_attending")}>
              <option value="leave">Leave for the day</option>
              <option value="not_attending">Not attending this Sabha</option>
            </Select>
          </Field>
          {kind === "leave" ? (
            <Field label="Date" htmlFor="day">
              <Input id="day" type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} required />
            </Field>
          ) : (
            <Field label="Sabha" htmlFor="session">
              <Select id="session" required value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">Choose a session</option>
                {sessions.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.sessionDate)} · {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Reason" htmlFor="reason">
            <Textarea
              id="reason"
              required
              minLength={8}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Family function in town / travelling…"
            />
          </Field>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? "Sending…" : "Send for approval"}
          </Button>
        </form>
      </Card>

      <h2 className="mt-8 font-display text-xl font-semibold">Your requests</h2>
      <ul className="mt-3 grid gap-2">
        {rows.length ? (
          rows.map((r) => (
            <li key={r.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {requestTypeLabel(r.requestType)} · {formatDate(r.dayDate)}
                    </p>
                    <p className="text-sm text-muted-foreground">{r.sessionName ?? r.reason}</p>
                  </div>
                  <Badge tone={r.status === "approved" ? "ok" : r.status === "pending" ? "warn" : "neutral"}>
                    {requestStatusLabel(r.status)}
                  </Badge>
                </div>
                {r.status === "pending" ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={withdraw.isPending}
                    onClick={() => withdraw.mutate(r.id)}
                  >
                    Withdraw
                  </Button>
                ) : null}
              </Card>
            </li>
          ))
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">No leave requests yet.</Card>
        )}
      </ul>
    </AppShell>
  );
}
