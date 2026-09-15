import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { asBool, asIso, asNumber, formatDuration, formatTime } from "@/lib/format";
import { assertStaff, canViewAudit, canViewReports } from "@/lib/roles";
import { ensureProfile } from "./profile";

export type ReportRow = {
  date: string;
  sessionName: string;
  locationName: string;
  userName: string;
  entry: string | null;
  exit: string | null;
  durationSeconds: number | null;
  status: string;
  isLate: boolean;
  hasLocationException: boolean;
};

export const getReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { from: string; to: string; userId?: string }) => {
    if (!d.from || !d.to) throw new Error("Choose a date range.");
    return { from: d.from.slice(0, 10), to: d.to.slice(0, 10), userId: d.userId };
  })
  .handler(async ({ context, data }): Promise<{ rows: ReportRow[]; csv: string; metrics: Record<string, number> }> => {
    const actor = await ensureProfile(context.userId);
    if (!canViewReports(actor.role)) {
      throw Object.assign(new Error("You cannot view reports."), { status: 403 });
    }
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select r.*, s.name as session_name, s.session_date, l.name as location_name, p.full_name
       from attendance_records r
       join sabha_sessions s on s.id = r.session_id
       join sabha_locations l on l.id = r.location_id
       join profiles p on p.user_id = r.user_id
       where s.organization_id = $1
         and s.session_date >= $2::date
         and s.session_date <= $3::date
         and r.status <> 'cancelled'
         and ($4::text is null or r.user_id = $4)
       order by s.session_date desc, p.full_name asc`,
      [actor.organizationId, data.from, data.to, data.userId ?? null],
    );

    const mapped: ReportRow[] = rows.map((r) => ({
      date: String(r.session_date).slice(0, 10),
      sessionName: String(r.session_name ?? ""),
      locationName: String(r.location_name ?? ""),
      userName: String(r.full_name ?? ""),
      entry: asIso(r.punch_in_time),
      exit: asIso(r.punch_out_time),
      durationSeconds: asNumber(r.duration_seconds),
      status: String(r.status),
      isLate: asBool(r.is_late),
      hasLocationException: asBool(r.has_location_exception),
    }));

    const registered = await sql<{ c: number }>`
      select count(*)::int as c from profiles
      where organization_id = ${actor.organizationId} and status = 'active'
    `;

    const metrics = {
      registered: registered[0]?.c ?? 0,
      present: mapped.length,
      completed: mapped.filter((r) => r.status === "completed").length,
      late: mapped.filter((r) => r.isLate).length,
      exceptions: mapped.filter((r) => r.hasLocationException).length,
      missingPunchOut: mapped.filter((r) => r.status === "active").length,
      averageDuration: mapped.filter((r) => r.durationSeconds != null).length
        ? Math.round(
            mapped.reduce((s, r) => s + (r.durationSeconds ?? 0), 0) /
              mapped.filter((r) => r.durationSeconds != null).length,
          )
        : 0,
    };

    const header = [
      "Date",
      "Sabha",
      "Location",
      "Name",
      "Entry",
      "Exit",
      "Duration",
      "Status",
      "Late",
      "Location exception",
    ];
    const csvLines = [
      header.join(","),
      ...mapped.map((r) =>
        [
          r.date,
          csv(r.sessionName),
          csv(r.locationName),
          csv(r.userName),
          r.entry ? formatTime(r.entry) : "",
          r.exit ? formatTime(r.exit) : "",
          formatDuration(r.durationSeconds),
          r.status,
          r.isLate ? "yes" : "no",
          r.hasLocationException ? "yes" : "no",
        ].join(","),
      ),
    ];

    return { rows: mapped, csv: csvLines.join("\n"), metrics };
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const actor = await ensureProfile(context.userId);
    if (!canViewAudit(actor.role)) {
      throw Object.assign(new Error("You cannot view the audit log."), { status: 403 });
    }
    assertStaff(actor);
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select a.*, p.full_name as actor_name
      from audit_logs a
      left join profiles p on p.user_id = a.actor_user_id
      where a.organization_id = ${actor.organizationId}
      order by a.created_at desc
      limit 80
    `;
    return rows.map((r) => ({
      id: String(r.id),
      actorName: String(r.actor_name ?? r.actor_user_id),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: r.entity_id ? String(r.entity_id) : null,
      reason: r.reason ? String(r.reason) : null,
      oldValue: r.old_value ? String(r.old_value) : null,
      newValue: r.new_value ? String(r.new_value) : null,
      createdAt: asIso(r.created_at) ?? "",
    }));
  });

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}


