import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { describeGeofence, evaluateGeofence } from "@/lib/geo";
import {
  checkPunchRateLimit,
  describePunchWindow,
  durationSeconds,
  evaluatePunchInWindow,
  evaluatePunchOutWindow,
  isLate,
  type SessionWindow,
} from "@/lib/punch-rules";
import { assertActive } from "@/lib/roles";
import type { AttendanceRecord, HomeData, PunchResult, SabhaSession } from "@/lib/types";
import { mapAttendance, mapSession } from "./map";
import { ensureProfile } from "./profile";

type Sql = Awaited<ReturnType<typeof getSql>>;

type PunchPayload = {
  sessionId: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  clientTime: string;
  userAgent?: string;
  forceException?: boolean;
};

function parsePayload(d: PunchPayload): PunchPayload {
  if (!d?.sessionId) throw new Error("A Sabha session is required.");
  return {
    sessionId: String(d.sessionId),
    latitude: typeof d.latitude === "number" ? d.latitude : null,
    longitude: typeof d.longitude === "number" ? d.longitude : null,
    accuracy: typeof d.accuracy === "number" ? d.accuracy : null,
    clientTime: d.clientTime || new Date().toISOString(),
    userAgent: d.userAgent?.slice(0, 300),
    forceException: Boolean(d.forceException),
  };
}

const sessionSelect = `
  s.id, s.organization_id, s.location_id, s.name, s.session_date,
  s.scheduled_start, s.scheduled_end, s.punch_in_open_time, s.punch_in_close_time,
  s.punch_out_close_time, s.status, s.allow_location_exceptions,
  s.allow_out_of_geofence_punch_out,
  l.name as location_name, l.address as location_address,
  l.latitude, l.longitude, l.allowed_radius_meters
`;

async function loadOpenSession(sql: Sql, sessionId: string): Promise<SabhaSession | null> {
  const found = await sql.query<Record<string, unknown>>(
    `select ${sessionSelect}
     from sabha_sessions s
     join sabha_locations l on l.id = s.location_id
     where s.id = $1
     limit 1`,
    [sessionId],
  );
  return found[0] ? mapSession(found[0]) : null;
}

async function loadCurrentSession(sql: Sql, organizationId: string): Promise<SabhaSession | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `select ${sessionSelect}
     from sabha_sessions s
     join sabha_locations l on l.id = s.location_id
     where s.organization_id = $1
       and s.status <> 'cancelled'
       and now() >= s.punch_in_open_time
       and now() <= s.scheduled_end
     order by s.scheduled_start asc
     limit 1`,
    [organizationId],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

function toWindow(session: SabhaSession): SessionWindow {
  return {
    punchInOpen: new Date(session.punchInOpenTime),
    punchInClose: new Date(session.punchInCloseTime),
    scheduledStart: new Date(session.scheduledStart),
    scheduledEnd: new Date(session.scheduledEnd),
    punchOutClose: session.punchOutCloseTime ? new Date(session.punchOutCloseTime) : null,
    status: session.status,
  };
}

async function loadMyRecord(
  sql: Sql,
  userId: string,
  sessionId: string,
): Promise<AttendanceRecord | null> {
  const rows = await sql<Record<string, unknown>>`
    select * from attendance_records
    where user_id = ${userId} and session_id = ${sessionId} and status <> 'cancelled'
    limit 1
  `;
  return rows[0] ? mapAttendance(rows[0]) : null;
}

export const getHomeData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<HomeData> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const session = await loadCurrentSession(sql, profile.organizationId);
    const attendance = session ? await loadMyRecord(sql, profile.userId, session.id) : null;
    const recentRows = await sql<Record<string, unknown>>`
      select r.*, s.name as session_name, s.session_date, l.name as location_name
      from attendance_records r
      join sabha_sessions s on s.id = r.session_id
      join sabha_locations l on l.id = r.location_id
      where r.user_id = ${profile.userId} and r.status <> 'cancelled'
      order by coalesce(r.punch_in_time, r.created_at) desc
      limit 8
    `;
    const statsRows = await sql<{ present: number; total: number }>`
      select
        count(*) filter (where r.status in ('active', 'completed'))::int as present,
        (select count(*)::int from sabha_sessions s
          where s.organization_id = ${profile.organizationId}
            and s.status <> 'cancelled'
            and s.scheduled_end < now()) as total
      from attendance_records r
      where r.user_id = ${profile.userId} and r.status in ('active', 'completed')
    `;
    return {
      profile,
      session,
      attendance,
      recent: recentRows.map(mapAttendance),
      stats: {
        presentCount: statsRows[0]?.present ?? 0,
        totalSessions: statsRows[0]?.total ?? 0,
      },
    };
  });

export const punchIn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parsePayload)
  .handler(async ({ context, data }): Promise<PunchResult> => {
    const profile = await ensureProfile(context.userId);
    assertActive(profile);
    if (!checkPunchRateLimit(profile.userId)) {
      return {
        ok: false,
        code: "RATE_LIMIT",
        message: "Please wait a moment before trying again.",
      };
    }

    const sql = await getSql();
    const session = await loadOpenSession(sql, data.sessionId);
    if (!session) {
      return { ok: false, code: "NO_SESSION", message: "There is no active Sabha attendance session right now." };
    }

    const windowVerdict = evaluatePunchInWindow(new Date(), toWindow(session));
    if (windowVerdict !== "ok") {
      return { ok: false, code: "WINDOW_CLOSED", message: describePunchWindow(windowVerdict) };
    }

    const existing = await loadMyRecord(sql, profile.userId, session.id);
    if (existing?.status === "active") {
      return { ok: false, code: "ALREADY_IN", message: "You’re already checked in for this Sabha." };
    }
    if (existing?.status === "completed") {
      return { ok: false, code: "ALREADY_OUT", message: "Your attendance for this Sabha is already complete." };
    }

    const fence = evaluateGeofence({
      userLat: data.latitude,
      userLng: data.longitude,
      accuracy: data.accuracy,
      sabhaLat: session.latitude ?? 0,
      sabhaLng: session.longitude ?? 0,
      radiusMeters: session.allowedRadiusMeters ?? 100,
      allowExceptions: session.allowLocationExceptions && Boolean(data.forceException),
    });

    if (!fence.canProceed) {
      const code =
        fence.verdict === "missing"
          ? "LOCATION_MISSING"
          : fence.verdict === "inaccurate"
            ? "GPS_INACCURATE"
            : "OUTSIDE_GEOFENCE";
      return {
        ok: false,
        code,
        message: describeGeofence(fence),
        distanceMeters: fence.distanceMeters,
        accuracyMeters: fence.accuracyMeters,
        canRetryWithException: session.allowLocationExceptions,
      };
    }

    const id = crypto.randomUUID();
    const late = isLate(new Date(), new Date(session.scheduledStart));
    const exception = fence.isException;

    try {
      await sql`
        insert into attendance_records (
          id, organization_id, user_id, session_id, location_id, status,
          punch_in_time, punch_in_latitude, punch_in_longitude, punch_in_accuracy,
          punch_in_distance_from_location, punch_in_client_time,
          is_late, has_location_exception
        ) values (
          ${id},
          ${profile.organizationId},
          ${profile.userId},
          ${session.id},
          ${session.locationId},
          'active',
          now(),
          ${data.latitude},
          ${data.longitude},
          ${data.accuracy},
          ${fence.distanceMeters},
          ${data.clientTime},
          ${late},
          ${exception}
        )
      `;
    } catch {
      return { ok: false, code: "ALREADY_IN", message: "You’re already checked in for this Sabha." };
    }

    await sql`
      insert into attendance_events (
        id, attendance_record_id, user_id, session_id, event_type,
        server_timestamp, client_timestamp, latitude, longitude, accuracy,
        distance_from_location, user_agent, notes, created_by
      ) values (
        ${crypto.randomUUID()},
        ${id},
        ${profile.userId},
        ${session.id},
        ${"PUNCH_IN"},
        now(),
        ${data.clientTime},
        ${data.latitude},
        ${data.longitude},
        ${data.accuracy},
        ${fence.distanceMeters},
        ${data.userAgent ?? null},
        ${exception ? `Location exception (${fence.verdict})` : null},
        ${profile.userId}
      )
    `;

    if (exception) {
      await sql`
        insert into attendance_events (
          id, attendance_record_id, user_id, session_id, event_type,
          server_timestamp, notes, created_by
        ) values (
          ${crypto.randomUUID()},
          ${id},
          ${profile.userId},
          ${session.id},
          ${"LOCATION_EXCEPTION"},
          now(),
          ${`Punch-in ${fence.verdict}`},
          ${profile.userId}
        )
      `;
    }

    const record = await loadMyRecord(sql, profile.userId, session.id);
    if (!record) throw new Error("Attendance was recorded but could not be loaded.");
    return {
      ok: true,
      record,
      geofenceVerdict: fence.verdict,
      exception,
    };
  });

export const punchOut = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parsePayload)
  .handler(async ({ context, data }): Promise<PunchResult> => {
    const profile = await ensureProfile(context.userId);
    assertActive(profile);
    if (!checkPunchRateLimit(profile.userId)) {
      return { ok: false, code: "RATE_LIMIT", message: "Please wait a moment before trying again." };
    }

    const sql = await getSql();
    const session = await loadOpenSession(sql, data.sessionId);
    if (!session) {
      return { ok: false, code: "NO_SESSION", message: "There is no active Sabha attendance session right now." };
    }

    const windowVerdict = evaluatePunchOutWindow(new Date(), toWindow(session));
    if (windowVerdict !== "ok") {
      return { ok: false, code: "WINDOW_CLOSED", message: describePunchWindow(windowVerdict) };
    }

    const existing = await loadMyRecord(sql, profile.userId, session.id);
    if (!existing) {
      return { ok: false, code: "NOT_CHECKED_IN", message: "You have not punched in for this Sabha yet." };
    }
    if (existing.status === "completed") {
      return { ok: false, code: "ALREADY_OUT", message: "Your attendance for this Sabha is already complete." };
    }

    const fence = evaluateGeofence({
      userLat: data.latitude,
      userLng: data.longitude,
      accuracy: data.accuracy,
      sabhaLat: session.latitude ?? 0,
      sabhaLng: session.longitude ?? 0,
      radiusMeters: session.allowedRadiusMeters ?? 100,
      allowExceptions:
        (session.allowLocationExceptions && Boolean(data.forceException)) ||
        session.allowOutOfGeofencePunchOut,
      allowOutside: session.allowOutOfGeofencePunchOut,
    });

    if (!fence.canProceed) {
      const code =
        fence.verdict === "missing"
          ? "LOCATION_MISSING"
          : fence.verdict === "inaccurate"
            ? "GPS_INACCURATE"
            : "OUTSIDE_GEOFENCE";
      return {
        ok: false,
        code,
        message: describeGeofence(fence),
        distanceMeters: fence.distanceMeters,
        accuracyMeters: fence.accuracyMeters,
        canRetryWithException: session.allowLocationExceptions || session.allowOutOfGeofencePunchOut,
      };
    }

    const inTime = existing.punchInTime ? new Date(existing.punchInTime) : new Date();
    const now = new Date();
    const dur = durationSeconds(inTime, now);
    const exception = existing.hasLocationException || fence.isException;

    await sql`
      update attendance_records
      set status = 'completed',
          punch_out_time = now(),
          punch_out_latitude = ${data.latitude},
          punch_out_longitude = ${data.longitude},
          punch_out_accuracy = ${data.accuracy},
          punch_out_distance_from_location = ${fence.distanceMeters},
          punch_out_client_time = ${data.clientTime},
          duration_seconds = ${dur},
          has_location_exception = ${exception},
          missing_punch_out = false,
          updated_at = now()
      where id = ${existing.id} and user_id = ${profile.userId} and status = 'active'
    `;

    await sql`
      insert into attendance_events (
        id, attendance_record_id, user_id, session_id, event_type,
        server_timestamp, client_timestamp, latitude, longitude, accuracy,
        distance_from_location, user_agent, notes, created_by
      ) values (
        ${crypto.randomUUID()},
        ${existing.id},
        ${profile.userId},
        ${session.id},
        ${"PUNCH_OUT"},
        now(),
        ${data.clientTime},
        ${data.latitude},
        ${data.longitude},
        ${data.accuracy},
        ${fence.distanceMeters},
        ${data.userAgent ?? null},
        ${fence.isException ? `Location exception (${fence.verdict})` : null},
        ${profile.userId}
      )
    `;

    const record = await loadMyRecord(sql, profile.userId, session.id);
    if (!record) throw new Error("Attendance was recorded but could not be loaded.");
    return { ok: true, record, geofenceVerdict: fence.verdict, exception };
  });
