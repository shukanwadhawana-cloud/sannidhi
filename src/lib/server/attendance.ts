import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { durationSeconds } from "@/lib/punch-rules";
import { assertStaff, canCorrectAttendance } from "@/lib/roles";
import type { AdminOverview, AttendanceRecord } from "@/lib/types";
import { mapAttendance, mapSession, writeAudit } from "./map";
import { ensureProfile } from "./profile";

type Sql = Awaited<ReturnType<typeof getSql>>;

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();

    const sessionRows = await sql.query<Record<string, unknown>>(
      `select s.*, l.name as location_name, l.address as location_address,
              l.latitude, l.longitude, l.allowed_radius_meters
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.organization_id = $1
         and s.status <> 'cancelled'
         and s.session_date = (now() at time zone 'Asia/Kolkata')::date
       order by s.scheduled_start asc`,
      [profile.organizationId],
    );
    const sessions = sessionRows.map(mapSession);
    const ids = sessions.map((s) => s.id);

    let counts: Record<string, { present: number; completed: number; exceptions: number }> = {};
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      const cRows = await sql.query<{
        session_id: string;
        present: number;
        completed: number;
        exceptions: number;
      }>(
        `select session_id,
                count(*) filter (where status = 'active')::int as present,
                count(*) filter (where status = 'completed')::int as completed,
                count(*) filter (where has_location_exception)::int as exceptions
         from attendance_records
         where session_id in (${placeholders})
           and status <> 'cancelled'
         group by session_id`,
        ids,
      );
      counts = Object.fromEntries(
        cRows.map((r) => [
          r.session_id,
          { present: r.present, completed: r.completed, exceptions: r.exceptions },
        ]),
      );
    }

    const today = await sql<{
      checked_in: number;
      checked_out: number;
      present: number;
      exceptions: number;
      late: number;
    }>`
      select
        count(*) filter (where r.status in ('active','completed'))::int as checked_in,
        count(*) filter (where r.status = 'completed')::int as checked_out,
        count(*) filter (where r.status = 'active')::int as present,
        count(*) filter (where r.has_location_exception)::int as exceptions,
        count(*) filter (where r.is_late)::int as late
      from attendance_records r
      join sabha_sessions s on s.id = r.session_id
      where s.organization_id = ${profile.organizationId}
        and s.session_date = (now() at time zone 'Asia/Kolkata')::date
        and r.status <> 'cancelled'
    `;

    return {
      profile,
      todaySessions: sessions.length,
      checkedIn: today[0]?.checked_in ?? 0,
      checkedOut: today[0]?.checked_out ?? 0,
      currentlyPresent: today[0]?.present ?? 0,
      locationExceptions: today[0]?.exceptions ?? 0,
      lateArrivals: today[0]?.late ?? 0,
      sessions: sessions.map((session) => ({
        session,
        present: counts[session.id]?.present ?? 0,
        completed: counts[session.id]?.completed ?? 0,
        exceptions: counts[session.id]?.exceptions ?? 0,
      })),
    };
  });

export const listLiveAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((sessionId: string) => {
    if (!sessionId) throw new Error("Session is required.");
    return sessionId;
  })
  .handler(async ({ context, data }): Promise<AttendanceRecord[]> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select r.*, p.full_name
      from attendance_records r
      join profiles p on p.user_id = r.user_id
      join sabha_sessions s on s.id = r.session_id
      where r.session_id = ${data}
        and s.organization_id = ${profile.organizationId}
        and r.status <> 'cancelled'
      order by r.punch_in_time asc nulls last
    `;
    return rows.map(mapAttendance);
  });

export const listMyHistory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }): Promise<AttendanceRecord[]> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select r.*, s.name as session_name, s.session_date, l.name as location_name
      from attendance_records r
      join sabha_sessions s on s.id = r.session_id
      join sabha_locations l on l.id = r.location_id
      where r.user_id = ${profile.userId}
        and r.status <> 'cancelled'
      order by coalesce(r.punch_in_time, r.created_at) desc
      limit 60
    `;
    const mapped = rows.map(mapAttendance);
    if (data.status && data.status !== "all") {
      if (data.status === "exception") return mapped.filter((r) => r.hasLocationException);
      return mapped.filter((r) => r.status === data.status);
    }
    return mapped;
  });

type CorrectionInput = {
  recordId?: string;
  userId: string;
  sessionId: string;
  punchInTime?: string | null;
  punchOutTime?: string | null;
  reason: string;
};

export const correctAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CorrectionInput) => {
    const reason = (d.reason ?? "").trim();
    if (reason.length < 4) throw new Error("A reason is required for every correction.");
    if (!d.userId || !d.sessionId) throw new Error("Choose a satsangi and a session.");
    return {
      recordId: d.recordId,
      userId: d.userId,
      sessionId: d.sessionId,
      punchInTime: d.punchInTime || null,
      punchOutTime: d.punchOutTime || null,
      reason: reason.slice(0, 400),
    };
  })
  .handler(async ({ context, data }) => {
    const actor = await ensureProfile(context.userId);
    if (!canCorrectAttendance(actor.role)) {
      throw Object.assign(new Error("You cannot correct attendance."), { status: 403 });
    }
    const sql = await getSql();
    const session = await sql<{ id: string; location_id: string; organization_id: string }>`
      select id, location_id, organization_id from sabha_sessions
      where id = ${data.sessionId} and organization_id = ${actor.organizationId}
      limit 1
    `;
    if (!session[0]) throw new Error("Session not found.");

    const existing = await sql<Record<string, unknown>>`
      select * from attendance_records
      where user_id = ${data.userId} and session_id = ${data.sessionId} and status <> 'cancelled'
      limit 1
    `;

    const inTime = data.punchInTime ? new Date(data.punchInTime) : null;
    const outTime = data.punchOutTime ? new Date(data.punchOutTime) : null;
    if (inTime && Number.isNaN(inTime.getTime())) throw new Error("Entry time is not valid.");
    if (outTime && Number.isNaN(outTime.getTime())) throw new Error("Exit time is not valid.");
    if (inTime && outTime && outTime < inTime) throw new Error("Exit time cannot be before entry time.");

    const status = outTime ? "completed" : inTime ? "active" : "active";
    const dur = inTime && outTime ? durationSeconds(inTime, outTime) : null;
    const id = existing[0] ? String(existing[0].id) : crypto.randomUUID();

    if (existing[0]) {
      await sql`
        update attendance_records
        set punch_in_time = ${inTime ? inTime.toISOString() : null},
            punch_out_time = ${outTime ? outTime.toISOString() : null},
            duration_seconds = ${dur},
            status = ${status},
            missing_punch_out = ${Boolean(inTime && !outTime && status === "active")},
            updated_at = now()
        where id = ${id}
      `;
    } else {
      await sql`
        insert into attendance_records (
          id, organization_id, user_id, session_id, location_id, status,
          punch_in_time, punch_out_time, duration_seconds, has_location_exception
        ) values (
          ${id},
          ${actor.organizationId},
          ${data.userId},
          ${data.sessionId},
          ${session[0].location_id},
          ${status},
          ${inTime ? inTime.toISOString() : null},
          ${outTime ? outTime.toISOString() : null},
          ${dur},
          false
        )
      `;
    }

    if (inTime) {
      await sql`
        insert into attendance_events (
          id, attendance_record_id, user_id, session_id, event_type,
          server_timestamp, notes, created_by
        ) values (
          ${crypto.randomUUID()}, ${id}, ${data.userId}, ${data.sessionId},
          ${"MANUAL_PUNCH_IN"}, now(), ${data.reason}, ${actor.userId}
        )
      `;
    }
    if (outTime) {
      await sql`
        insert into attendance_events (
          id, attendance_record_id, user_id, session_id, event_type,
          server_timestamp, notes, created_by
        ) values (
          ${crypto.randomUUID()}, ${id}, ${data.userId}, ${data.sessionId},
          ${"MANUAL_PUNCH_OUT"}, now(), ${data.reason}, ${actor.userId}
        )
      `;
    }
    await sql`
      insert into attendance_events (
        id, attendance_record_id, user_id, session_id, event_type,
        server_timestamp, notes, created_by
      ) values (
        ${crypto.randomUUID()}, ${id}, ${data.userId}, ${data.sessionId},
        ${"CORRECTION"}, now(), ${data.reason}, ${actor.userId}
      )
    `;
    await writeAudit(sql, {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "correct_attendance",
      entityType: "attendance_record",
      entityId: id,
      oldValue: existing[0] ?? null,
      newValue: { punchInTime: data.punchInTime, punchOutTime: data.punchOutTime },
      reason: data.reason,
    });

    const rows = await sql<Record<string, unknown>>`
      select r.*, p.full_name from attendance_records r
      join profiles p on p.user_id = r.user_id
      where r.id = ${id}
    `;
    return mapAttendance(rows[0]!);
  });

export async function loadEvents(sql: Sql, recordId: string) {
  return sql<Record<string, unknown>>`
    select * from attendance_events
    where attendance_record_id = ${recordId}
    order by created_at asc
  `;
}
