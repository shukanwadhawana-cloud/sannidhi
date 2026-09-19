import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { durationSeconds } from "@/lib/punch-rules";
import { isRequestType, validateRequestDraft } from "@/lib/request-rules";
import { assertStaff, canApproveRequests } from "@/lib/roles";
import type { AttendanceRequest, SabhaSession } from "@/lib/types";
import { mapRequest, mapSession, writeAudit } from "./map";
import { ensureProfile } from "./profile";

type Sql = Awaited<ReturnType<typeof getSql>>;

const requestSelect = `
  q.id, q.organization_id, q.user_id, q.session_id, q.day_date, q.request_type,
  q.status, q.requested_punch_in, q.requested_punch_out, q.reason,
  q.reviewer_user_id, q.reviewer_note, q.reviewed_at, q.created_at,
  p.full_name,
  s.name as session_name,
  l.name as location_name,
  rv.full_name as reviewer_name
`;

async function loadRequest(sql: Sql, id: string, organizationId: string): Promise<AttendanceRequest | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `select ${requestSelect}
     from attendance_requests q
     join profiles p on p.user_id = q.user_id
     left join sabha_sessions s on s.id = q.session_id
     left join sabha_locations l on l.id = s.location_id
     left join profiles rv on rv.user_id = q.reviewer_user_id
     where q.id = $1 and q.organization_id = $2
     limit 1`,
    [id, organizationId],
  );
  return rows[0] ? mapRequest(rows[0]) : null;
}

type CreateInput = {
  requestType: string;
  sessionId?: string | null;
  dayDate: string;
  requestedPunchIn?: string | null;
  requestedPunchOut?: string | null;
  reason: string;
};

export const createAttendanceRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: CreateInput) => {
    if (!isRequestType(d.requestType)) throw new Error("That request type is not valid.");
    const draft = {
      requestType: d.requestType,
      sessionId: d.sessionId || null,
      dayDate: d.dayDate,
      requestedPunchIn: d.requestedPunchIn || null,
      requestedPunchOut: d.requestedPunchOut || null,
      reason: (d.reason ?? "").trim(),
    };
    const err = validateRequestDraft(draft);
    if (err) throw new Error(err);
    return {
      ...draft,
      reason: draft.reason.slice(0, 500),
    };
  })
  .handler(async ({ context, data }): Promise<AttendanceRequest> => {
    const profile = await ensureProfile(context.userId);
    if (profile.status !== "active") throw new Error("This account is inactive.");
    const sql = await getSql();

    let sessionId = data.sessionId;
    let dayDate = data.dayDate;
    if (sessionId) {
      const session = await sql<{ id: string; session_date: string; organization_id: string }>`
        select id, session_date::text as session_date, organization_id
        from sabha_sessions
        where id = ${sessionId} and organization_id = ${profile.organizationId} and status <> 'cancelled'
        limit 1
      `;
      if (!session[0]) throw new Error("That Sabha session was not found.");
      dayDate = String(session[0].session_date).slice(0, 10);
    }

    try {
      await sql`
        insert into attendance_requests (
          id, organization_id, user_id, session_id, day_date, request_type, status,
          requested_punch_in, requested_punch_out, reason
        ) values (
          ${crypto.randomUUID()},
          ${profile.organizationId},
          ${profile.userId},
          ${sessionId},
          ${dayDate},
          ${data.requestType},
          'pending',
          ${data.requestedPunchIn},
          ${data.requestedPunchOut},
          ${data.reason}
        )
      `;
    } catch {
      throw new Error("You already have a pending request of this type for that day.");
    }

    const rows = await sql.query<Record<string, unknown>>(
      `select ${requestSelect}
       from attendance_requests q
       join profiles p on p.user_id = q.user_id
       left join sabha_sessions s on s.id = q.session_id
       left join sabha_locations l on l.id = s.location_id
       left join profiles rv on rv.user_id = q.reviewer_user_id
       where q.user_id = $1
       order by q.created_at desc
       limit 1`,
      [profile.userId],
    );
    return mapRequest(rows[0]!);
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AttendanceRequest[]> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${requestSelect}
       from attendance_requests q
       join profiles p on p.user_id = q.user_id
       left join sabha_sessions s on s.id = q.session_id
       left join sabha_locations l on l.id = s.location_id
       left join profiles rv on rv.user_id = q.reviewer_user_id
       where q.user_id = $1
       order by q.created_at desc
       limit 40`,
      [profile.userId],
    );
    return rows.map(mapRequest);
  });

export const listPendingRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AttendanceRequest[]> => {
    const actor = await ensureProfile(context.userId);
    assertStaff(actor);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${requestSelect}
       from attendance_requests q
       join profiles p on p.user_id = q.user_id
       left join sabha_sessions s on s.id = q.session_id
       left join sabha_locations l on l.id = s.location_id
       left join profiles rv on rv.user_id = q.reviewer_user_id
       where q.organization_id = $1 and q.status = 'pending'
       order by q.created_at asc
       limit 80`,
      [actor.organizationId],
    );
    return rows.map(mapRequest);
  });

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id) throw new Error("Choose a request to withdraw.");
    return id;
  })
  .handler(async ({ context, data }) => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const updated = await sql`
      update attendance_requests
      set status = 'cancelled', updated_at = now()
      where id = ${data} and user_id = ${profile.userId} and status = 'pending'
      returning id
    `;
    if (!updated[0]) throw new Error("That request can no longer be withdrawn.");
    return { ok: true as const };
  });

type ReviewInput = { id: string; decision: "approved" | "rejected"; note?: string };

export const reviewAttendanceRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ReviewInput) => {
    if (!d.id) throw new Error("Choose a request.");
    if (d.decision !== "approved" && d.decision !== "rejected") {
      throw new Error("Choose approve or decline.");
    }
    return {
      id: d.id,
      decision: d.decision,
      note: (d.note ?? "").trim().slice(0, 400) || null,
    };
  })
  .handler(async ({ context, data }): Promise<AttendanceRequest> => {
    const actor = await ensureProfile(context.userId);
    if (!canApproveRequests(actor.role)) {
      throw Object.assign(new Error("You cannot review attendance requests."), { status: 403 });
    }
    const sql = await getSql();
    const current = await loadRequest(sql, data.id, actor.organizationId);
    if (!current) throw new Error("Request not found.");
    if (current.status !== "pending") throw new Error("This request has already been reviewed.");
    if (current.userId === actor.userId && actor.role !== "super_admin") {
      throw new Error("Ask another coordinator to review your own request.");
    }

    if (data.decision === "approved" && current.requestType === "regularize") {
      await applyRegularization(sql, actor.userId, actor.organizationId, current);
    }

    await sql`
      update attendance_requests
      set status = ${data.decision},
          reviewer_user_id = ${actor.userId},
          reviewer_note = ${data.note},
          reviewed_at = now(),
          updated_at = now()
      where id = ${current.id} and status = 'pending'
    `;
    await writeAudit(sql, {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: data.decision === "approved" ? "approve_request" : "reject_request",
      entityType: "attendance_request",
      entityId: current.id,
      oldValue: current,
      newValue: { decision: data.decision, note: data.note },
      reason: current.reason,
    });
    const next = await loadRequest(sql, current.id, actor.organizationId);
    if (!next) throw new Error("Request was reviewed but could not be loaded.");
    return next;
  });

async function applyRegularization(
  sql: Sql,
  actorUserId: string,
  organizationId: string,
  req: AttendanceRequest,
) {
  if (!req.sessionId) throw new Error("This regularization has no Sabha session.");
  const session = await sql<{ id: string; location_id: string }>`
    select id, location_id from sabha_sessions
    where id = ${req.sessionId} and organization_id = ${organizationId}
    limit 1
  `;
  if (!session[0]) throw new Error("Session not found.");

  const existing = await sql<Record<string, unknown>>`
    select * from attendance_records
    where user_id = ${req.userId} and session_id = ${req.sessionId} and status <> 'cancelled'
    limit 1
  `;
  const inTime = req.requestedPunchIn
    ? new Date(req.requestedPunchIn)
    : existing[0]?.punch_in_time
      ? new Date(String(existing[0].punch_in_time))
      : null;
  const outTime = req.requestedPunchOut
    ? new Date(req.requestedPunchOut)
    : existing[0]?.punch_out_time
      ? new Date(String(existing[0].punch_out_time))
      : null;
  const status = outTime ? "completed" : "active";
  const dur = inTime && outTime ? durationSeconds(inTime, outTime) : null;
  const id = existing[0] ? String(existing[0].id) : crypto.randomUUID();

  if (existing[0]) {
    await sql`
      update attendance_records
      set punch_in_time = coalesce(${inTime ? inTime.toISOString() : null}, punch_in_time),
          punch_out_time = coalesce(${outTime ? outTime.toISOString() : null}, punch_out_time),
          duration_seconds = ${dur},
          status = ${status},
          missing_punch_out = ${Boolean(inTime && !outTime)},
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
        ${organizationId},
        ${req.userId},
        ${req.sessionId},
        ${session[0].location_id},
        ${status},
        ${inTime ? inTime.toISOString() : null},
        ${outTime ? outTime.toISOString() : null},
        ${dur},
        false
      )
    `;
  }

  await sql`
    insert into attendance_events (
      id, attendance_record_id, user_id, session_id, event_type,
      server_timestamp, notes, created_by
    ) values (
      ${crypto.randomUUID()}, ${id}, ${req.userId}, ${req.sessionId},
      ${"CORRECTION"}, now(), ${`Regularization approved: ${req.reason}`}, ${actorUserId}
    )
  `;
}

const sessionSelect = `
  s.id, s.organization_id, s.location_id, s.name, s.session_date,
  s.scheduled_start, s.scheduled_end, s.punch_in_open_time, s.punch_in_close_time,
  s.punch_out_close_time, s.status, s.allow_location_exceptions,
  s.allow_out_of_geofence_punch_out,
  l.name as location_name, l.address as location_address,
  l.latitude, l.longitude, l.allowed_radius_meters
`;

export const listRequestSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SabhaSession[]> => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${sessionSelect}
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.organization_id = $1
         and s.status <> 'cancelled'
         and s.session_date >= ((now() at time zone 'Asia/Kolkata')::date - interval '45 days')
       order by s.scheduled_start desc
       limit 40`,
      [profile.organizationId],
    );
    return rows.map(mapSession);
  });
