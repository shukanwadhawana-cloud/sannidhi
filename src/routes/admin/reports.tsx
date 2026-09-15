import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { formatDate, formatDuration, formatTime, ymdInZone } from "@/lib/format";
import { getReport } from "@/lib/server/reports";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const today = ymdInZone();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: today, to: today });
  const report = useQuery({
    queryKey: ["report", range.from, range.to],
    queryFn: () => getReport({ data: range }),
  });
  const m = report.data?.metrics;

  function download() {
    if (!report.data) return;
    const blob = new Blob([report.data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sannidhi-attendance-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">Daily, weekly, or monthly attendance. Export as CSV.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="from">
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="to">
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button onClick={() => setRange({ from, to })}>Apply</Button>
        <Button variant="outline" onClick={download} disabled={!report.data?.rows.length}>
          Export CSV
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Present records" value={m?.present ?? "—"} />
        <Stat label="Completed" value={m?.completed ?? "—"} />
        <Stat label="Late" value={m?.late ?? "—"} />
        <Stat label="Exceptions" value={m?.exceptions ?? "—"} />
        <Stat label="Missing punch-out" value={m?.missingPunchOut ?? "—"} />
        <Stat label="Registered" value={m?.registered ?? "—"} />
        <Stat label="Avg duration" value={formatDuration(m?.averageDuration ?? null)} />
      </div>
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Sabha</th>
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Entry</th>
              <th className="py-2 font-medium">Exit</th>
              <th className="py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {report.data?.rows.map((r, i) => (
              <tr key={`${r.userName}-${r.date}-${i}`} className="border-t border-border">
                <td className="py-3">{formatDate(r.date)}</td>
                <td>{r.sessionName}</td>
                <td>{r.userName}</td>
                <td className="tabular-nums">{formatTime(r.entry)}</td>
                <td className="tabular-nums">{formatTime(r.exit)}</td>
                <td className="tabular-nums">{formatDuration(r.durationSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-2 md:hidden">
        {report.data?.rows.map((r, i) => (
          <li key={`${r.userName}-${i}`}>
            <Card className="px-4 py-3">
              <p className="font-medium">{r.userName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(r.date)} · {r.sessionName}
              </p>
              <p className="text-sm tabular-nums">
                {formatTime(r.entry)} – {formatTime(r.exit)} · {formatDuration(r.durationSeconds)}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </Card>
  );
}
