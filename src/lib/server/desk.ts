import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { classifyDay, monthGrid } from "@/lib/calendar";
import { getSql } from "@/lib/db";
import { ymdInZone } from "@/lib/format";
import { assertAdmin, assertStaff } from "@/lib/roles";
import type { CalendarDay, MonthDesk, OrgPolicy, TeamMember, TeamRoster } from "@/lib/types";
import { mapProfile, mapSession, writeAudit } from "./map";
import { loadOrgPolicy } from "./policy";
import { ensureProfile } from "./profile";

const sessionSelect = `
  s.id, s.organization_id, s.location_id, s.name, s.session_date,
  s.scheduled_start, s.scheduled_end, s.punch_in_open_time, s.punch_in_close_time,
  s.punch_out_close_time, s.status, s.allow_location_exceptions,
  s.allow_out_of_geofence_punch_out,
  l.name as location_name, l.address as location_address,
  l.latitude, l.longitude, l.allowed_radius_meters
`;

export const getOrgPolicy = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<OrgPolicy> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    return loadOrgPolicy(sql, profile.organizationId);
  });

export const updateOrgPolicy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { graceMinutes: number }) => {
    const n = Number(d.graceMinutes);
    if (!Number.isFinite(n) || n < 0 || n > 120) {
      throw new Error("Grace minutes must be between 0 and 120.");
    }
    return { graceMinutes: Math.round(n) };
  })
  .handler(async ({ context, data }): Promise<OrgPolicy> => {
    const profile = await ensureProfile(context.userId);
    assertAdmin(profile);
    const sql = await getSql();
    const prev = await loadOrgPolicy(sql, profile.organizationId);
    await sql`
      update organizations
      set grace_minutes = ${data.graceMinutes}
      where id = ${profile.organizationId}
    `;
    await sql`
      insert into system_settings (key, value) values ('grace_minutes', ${String(data.graceMinutes)})
      on conflict (key) do update set value = excluded.value
    `;
    await writeAudit(sql, {
      organizationId: profile.organizationId,
      actorUserId: profile.userId,
      action: "update_policy",
      entityType: "organization",
      entityId: profile.organizationId,
      oldValue: prev,
      newValue: data,
    });
    return loadOrgPolicy(sql, profile.organizationId);
  });

export const getMonthDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { year: number; month: number }) => {
    const year = Number(d.year);
    const month = Number(d.month);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error("Choose a valid year.");
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Choose a valid month.");
    return { year, month };
  })
  .handler(async ({ context, data }): Promise<MonthDesk> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const start = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const next = data.month === 12
      ? `${data.year + 1}-01-01`
      : `${data.year}-${String(data.month + 1).padStart(2, "0")}-01`;
    const today = ymdInZone();

    const sessionRows = await sql<{ session_date: string; c: number }>`
      select session_date::text as session_date, count(*)::int as c
      from sabha_sessions
      where organization_id = ${profile.organizationId}
        and status <> 'cancelled'
        and session_date >= ${start}
        and session_date < ${next}
      group by session_date
    `;
    const sessionCounts = new Map(sessionRows.map((r) => [String(r.session_date).slice(0, 10), r.c]));

    const presentRows = await sql<{ session_date: string }>`
      select distinct s.session_date::text as session_date
      from attendance_records r
      join sabha_sessions s on s.id = r.session_id
      where r.user_id = ${profile.userId}
        and r.status in ('active', 'completed')
        and s.session_date >= ${start}
        and s.session_date < ${next}
    `;
    const present = new Set(presentRows.map((r) => String(r.session_date).slice(0, 10)));

    const leaveRows = await sql<{ day_date: string; request_type: string }>`
      select day_date::text as day_date, request_type
      from attendance_requests
      where user_id = ${profile.userId}
        and status = 'approved'
        and day_date >= ${start}
        and day_date < ${next}
        and request_type in ('leave', 'not_attending')
    `;
    const leave = new Set(
      leaveRows.filter((r) => r.request_type === "leave").map((r) => String(r.day_date).slice(0, 10)),
    );
    const notAttending = new Set(
      leaveRows.filter((r) => r.request_type === "not_attending").map((r) => String(r.day_date).slice(0, 10)),
    );

    const days: CalendarDay[] = monthGrid(data.year, data.month).map((cell) => {
      const hasSession = (sessionCounts.get(cell.date) ?? 0) > 0;
      const mark = classifyDay({
        hasSession,
        isFuture: cell.date > today,
        isToday: cell.date === today,
        hasPresent: present.has(cell.date),
        hasLeave: leave.has(cell.date),
        hasNotAttending: notAttending.has(cell.date),
      });
      return {
        date: cell.date,
        inMonth: cell.inMonth,
        mark,
        sessionCount: sessionCounts.get(cell.date) ?? 0,
        present: present.has(cell.date),
      };
    });

    const inMonth = days.filter((d) => d.inMonth);
    return {
      year: data.year,
      month: data.month,
      days,
      summary: {
        presentDays: inMonth.filter((d) => d.mark === "present").length,
        leaveDays: inMonth.filter((d) => d.mark === "leave" || d.mark === "not_attending").length,
        absentDays: inMonth.filter((d) => d.mark === "absent").length,
        sabhaDays: inMonth.filter((d) => d.sessionCount > 0).length,
      },
    };
  });

export const getTeamRoster = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<TeamRoster> => {
    const actor = await ensureProfile(context.userId);
    assertStaff(actor);
    const sql = await getSql();
    const today = ymdInZone();

    const sessionRows = await sql.query<Record<string, unknown>>(
      `select ${sessionSelect}
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.organization_id = $1
         and s.status <> 'cancelled'
         and now() >= s.punch_in_open_time
         and now() <= s.scheduled_end
       order by s.scheduled_start asc
       limit 1`,
      [actor.organizationId],
    );
    const session = sessionRows[0] ? mapSession(sessionRows[0]) : null;

    const people = await sql<Record<string, unknown>>`
      select * from profiles
      where organization_id = ${actor.organizationId} and status = 'active'
      order by full_name asc
    `;

    const attendance = session
      ? await sql<Record<string, unknown>>`
          select * from attendance_records
          where session_id = ${session.id} and status <> 'cancelled'
        `
      : [];
    const attByUser = new Map(attendance.map((r) => [String(r.user_id), r]));

    const leaveRows = await sql<{ user_id: string; request_type: string }>`
      select user_id, request_type
      from attendance_requests
      where organization_id = ${actor.organizationId}
        and status = 'approved'
        and day_date = ${today}
        and request_type in ('leave', 'not_attending')
    `;
    const onLeave = new Set(leaveRows.map((r) => r.user_id));

    const members: TeamMember[] = people.map((row) => {
      const profile = mapProfile(row);
      const rec = attByUser.get(profile.userId);
      const leave = onLeave.has(profile.userId);
      let status: TeamMember["status"] = "not_in";
      if (leave && !rec) status = "leave";
      else if (rec && String(rec.status) === "completed") status = "completed";
      else if (rec && (rec.has_location_exception === true || rec.has_location_exception === "t")) {
        status = "exception";
      } else if (rec && String(rec.status) === "active") status = "present";
      return {
        profile,
        status,
        punchInTime: rec?.punch_in_time ? new Date(String(rec.punch_in_time)).toISOString() : null,
        punchOutTime: rec?.punch_out_time ? new Date(String(rec.punch_out_time)).toISOString() : null,
        durationSeconds: rec?.duration_seconds == null ? null : Number(rec.duration_seconds),
        isLate: rec?.is_late === true || rec?.is_late === "t",
        hasLocationException:
          rec?.has_location_exception === true || rec?.has_location_exception === "t",
      };
    });

    return {
      session,
      members,
      counts: {
        present: members.filter((m) => m.status === "present" || m.status === "exception").length,
        completed: members.filter((m) => m.status === "completed").length,
        leave: members.filter((m) => m.status === "leave").length,
        notIn: members.filter((m) => m.status === "not_in").length,
        exceptions: members.filter((m) => m.status === "exception" || m.hasLocationException).length,
        total: members.length,
      },
    };
  });
