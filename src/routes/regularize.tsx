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
import { formatDate, formatTime, isoToIstInput, istInputToIso, requestStatusLabel } from "@/lib/format";
import { getMyProfile } from "@/lib/server/profile";
import { cancelMyRequest, createAttendanceRequest, listMyRequests, listRequestSessions } from "@/lib/server/requests";

export const Route = createFileRoute("/regularize")({ component: RegularizePage });

function RegularizePage() {
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

  const [sessionId, setSessionId] = useState("");
  const [inDate, setInDate] = useState(isoToIstInput().date);
  const [inTime, setInTime] = useState("08:00");
  const [outDate, setOutDate] = useState(isoToIstInput().date);
  const [outTime, setOutTime] = useState("");
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      createAttendanceRequest({
        data: {
          requestType: "regularize",
          sessionId,
          dayDate: inDate,
          requestedPunchIn: inTime ? istInputToIso(inDate, inTime) : null,
          requestedPunchOut: outTime ? istInputToIso(outDate, outTime) : null,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Regularization sent to a coordinator.");
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

  const regularize = mine.data?.filter((r) => r.requestType === "regularize") ?? [];

  return (
    <AppShell profile={profile.data}>
      <p className="text-sm font-medium text-muted-foreground">
        <Link to="/more" className="underline-offset-4 hover:underline">
          More
        </Link>
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Regularize</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use this when you were at Sabha but missed punch-in or punch-out. A coordinator must approve it.
      </p>

      <Card className="mt-6 p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <Field label="Sabha" htmlFor="session">
            <Select
              id="session"
              required
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                const s = sessions.data?.find((x) => x.id === e.target.value);
                if (s) {
                  const inn = isoToIstInput(s.scheduledStart);
                  const out = isoToIstInput(s.scheduledEnd);
                  setInDate(inn.date);
                  setInTime(inn.time);
                  setOutDate(out.date);
                  setOutTime(out.time);
                }
              }}
            >
              <option value="">Choose a session</option>
              {sessions.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.sessionDate)} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entry date" htmlFor="inDate">
              <Input id="inDate" type="date" value={inDate} onChange={(e) => setInDate(e.target.value)} required />
            </Field>
            <Field label="Entry time" htmlFor="inTime">
              <Input id="inTime" type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} required />
            </Field>
            <Field label="Exit date" htmlFor="outDate">
              <Input id="outDate" type="date" value={outDate} onChange={(e) => setOutDate(e.target.value)} />
            </Field>
            <Field label="Exit time" htmlFor="outTime" hint="Leave blank if you only missed punch-in.">
              <Input id="outTime" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Reason" htmlFor="reason">
            <Textarea
              id="reason"
              required
              minLength={8}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="I was in the hall but my phone had no GPS…"
            />
          </Field>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? "Sending…" : "Send for approval"}
          </Button>
        </form>
      </Card>

      <h2 className="mt-8 font-display text-xl font-semibold">Your requests</h2>
      <ul className="mt-3 grid gap-2">
        {regularize.length ? (
          regularize.map((r) => (
            <li key={r.id}>
              <Card className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.sessionName ?? "Sabha"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(r.dayDate)} · in {formatTime(r.requestedPunchIn)}
                      {r.requestedPunchOut ? ` – ${formatTime(r.requestedPunchOut)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
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
          <Card className="p-5 text-sm text-muted-foreground">No regularization requests yet.</Card>
        )}
      </ul>
    </AppShell>
  );
}
