import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/format";
import { listAudit } from "@/lib/server/reports";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

function AuditPage() {
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => listAudit() });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Administrative changes to attendance, sessions, locations, and people.
      </p>
      <ul className="mt-5 grid gap-2">
        {audit.data?.length ? (
          audit.data.map((row) => (
            <li key={row.id}>
              <Card className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{row.actorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(row.createdAt)} · {formatTime(row.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-sm">
                  {row.action.replaceAll("_", " ")} · {row.entityType}
                </p>
                {row.reason ? <p className="mt-1 text-sm text-muted-foreground">Reason: {row.reason}</p> : null}
              </Card>
            </li>
          ))
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">No administrative changes yet.</Card>
        )}
      </ul>
    </div>
  );
}
