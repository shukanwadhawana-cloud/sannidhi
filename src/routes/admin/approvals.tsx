import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { formatDate, formatTime, requestTypeLabel } from "@/lib/format";
import { listPendingRequests, reviewAttendanceRequest } from "@/lib/server/requests";
import type { AttendanceRequest } from "@/lib/types";

export const Route = createFileRoute("/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ["pending-requests"],
    queryFn: () => listPendingRequests(),
    refetchInterval: 12_000,
  });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const review = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected" }) =>
      reviewAttendanceRequest({
        data: { ...input, note: notes[input.id] },
      }),
    onSuccess: (_row, vars) => {
      toast.success(vars.decision === "approved" ? "Approved." : "Declined.");
      void qc.invalidateQueries({ queryKey: ["pending-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      void qc.invalidateQueries({ queryKey: ["team-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">Inbox</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Regularization, leave, and not-attending requests.
      </p>
      <ul className="mt-6 grid gap-3">
        {pending.data?.length ? (
          pending.data.map((row) => (
            <li key={row.id}>
              <RequestCard
                row={row}
                note={notes[row.id] ?? ""}
                onNote={(v) => setNotes((s) => ({ ...s, [row.id]: v }))}
                busy={review.isPending}
                onReview={(decision) => review.mutate({ id: row.id, decision })}
              />
            </li>
          ))
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">Nothing waiting for review.</Card>
        )}
      </ul>
    </div>
  );
}

function RequestCard({
  row,
  note,
  onNote,
  busy,
  onReview,
}: {
  row: AttendanceRequest;
  note: string;
  onNote: (v: string) => void;
  busy: boolean;
  onReview: (d: "approved" | "rejected") => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.userName ?? "Satsangi"}</p>
          <p className="text-sm text-muted-foreground">
            {requestTypeLabel(row.requestType)} · {formatDate(row.dayDate)}
            {row.sessionName ? ` · ${row.sessionName}` : ""}
          </p>
        </div>
        <Badge tone="warn">Pending</Badge>
      </div>
      {row.requestType === "regularize" ? (
        <p className="mt-2 text-sm tabular-nums">
          In {formatTime(row.requestedPunchIn)}
          {row.requestedPunchOut ? ` – out ${formatTime(row.requestedPunchOut)}` : ""}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed">{row.reason}</p>
      <Textarea
        className="mt-3"
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Optional note to the satsangi"
      />
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={() => onReview("approved")}>
          Approve
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => onReview("rejected")}>
          Decline
        </Button>
      </div>
    </Card>
  );
}
