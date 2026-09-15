import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assertStaff } from "@/lib/roles";
import type { SabhaSession } from "@/lib/types";
import { mapSession, writeAudit } from "./map";
import { ensureProfile } from "./profile";

type SessionInput = {
  id?: string;
  locationId: string;
  name: string;
  sessionDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  punchInOpenTime: string;
  punchInCloseTime: string;
  allowLocationExceptions: boolean;
  allowOutOfGeofencePunchOut: boolean;
  status?: "scheduled" | "open" | "closed" | "cancelled";
};

function parseSession(d: SessionInput): SessionInput {
  const name = (d.name ?? "").trim();
  if (name.length < 2) throw new Error("Please name this Sabha session.");
  if (!d.locationId) throw new Error("Choose a Sabha location.");
  const fields = [
    d.sessionDate,
    d.scheduledStart,
    d.scheduledEnd,
    d.punchInOpenTime,
    d.punchInCloseTime,
  ];
  if (fields.some((f) => !f)) throw new Error("Date and times are required.");
  const start = new Date(d.scheduledStart);
  const end = new Date(d.scheduledEnd);
  const open = new Date(d.punchInOpenTime);
  const close = new Date(d.punchInCloseTime);
  if ([start, end, open, close].some((x) => Number.isNaN(x.getTime()))) {
    throw new Error("One of the times is not valid.");
  }
  if (end <= start) throw new Error("The session must end after it starts.");
  if (close <= open) throw new Error("Punch-in must close after it opens.");
  return {
    id: d.id,
    locationId: d.locationId,
    name: name.slice(0, 80),
    sessionDate: d.sessionDate.slice(0, 10),
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
    punchInOpenTime: open.toISOString(),
    punchInCloseTime: close.toISOString(),
    allowLocationExceptions: Boolean(d.allowLocationExceptions),
    allowOutOfGeofencePunchOut: d.allowOutOfGeofencePunchOut !== false,
    status: d.status,
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

export const listSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SabhaSession[]> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${sessionSelect}
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.organization_id = $1
       order by s.scheduled_start desc
       limit 80`,
      [profile.organizationId],
    );
    return rows.map(mapSession);
  });

export const getSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    if (!id) throw new Error("Session is required.");
    return id;
  })
  .handler(async ({ context, data }): Promise<SabhaSession> => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(
      `select ${sessionSelect}
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.id = $1 and s.organization_id = $2
       limit 1`,
      [data, profile.organizationId],
    );
    if (!rows[0]) throw new Error("Session not found.");
    return mapSession(rows[0]);
  });

export const saveSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseSession)
  .handler(async ({ context, data }) => {
    const profile = await ensureProfile(context.userId);
    assertStaff(profile);
    const sql = await getSql();
    const loc = await sql<{ id: string }>`
      select id from sabha_locations
      where id = ${data.locationId} and organization_id = ${profile.organizationId}
      limit 1
    `;
    if (!loc[0]) throw new Error("That Sabha location was not found.");

    const id = data.id || crypto.randomUUID();
    const status = data.status ?? "scheduled";

    if (data.id) {
      const prev = await sql<Record<string, unknown>>`
        select * from sabha_sessions where id = ${id} and organization_id = ${profile.organizationId} limit 1
      `;
      await sql`
        update sabha_sessions
        set location_id = ${data.locationId},
            name = ${data.name},
            session_date = ${data.sessionDate},
            scheduled_start = ${data.scheduledStart},
            scheduled_end = ${data.scheduledEnd},
            punch_in_open_time = ${data.punchInOpenTime},
            punch_in_close_time = ${data.punchInCloseTime},
            allow_location_exceptions = ${data.allowLocationExceptions},
            allow_out_of_geofence_punch_out = ${data.allowOutOfGeofencePunchOut},
            status = ${status},
            updated_at = now()
        where id = ${id} and organization_id = ${profile.organizationId}
      `;
      await writeAudit(sql, {
        organizationId: profile.organizationId,
        actorUserId: profile.userId,
        action: "update_session",
        entityType: "sabha_session",
        entityId: id,
        oldValue: prev[0] ?? null,
        newValue: data,
      });
    } else {
      await sql`
        insert into sabha_sessions (
          id, organization_id, location_id, name, session_date,
          scheduled_start, scheduled_end, punch_in_open_time, punch_in_close_time,
          status, allow_location_exceptions, allow_out_of_geofence_punch_out, created_by
        ) values (
          ${id},
          ${profile.organizationId},
          ${data.locationId},
          ${data.name},
          ${data.sessionDate},
          ${data.scheduledStart},
          ${data.scheduledEnd},
          ${data.punchInOpenTime},
          ${data.punchInCloseTime},
          ${status},
          ${data.allowLocationExceptions},
          ${data.allowOutOfGeofencePunchOut},
          ${profile.userId}
        )
      `;
      await writeAudit(sql, {
        organizationId: profile.organizationId,
        actorUserId: profile.userId,
        action: "create_session",
        entityType: "sabha_session",
        entityId: id,
        newValue: data,
      });
    }
    const rows = await sql.query<Record<string, unknown>>(
      `select ${sessionSelect}
       from sabha_sessions s
       join sabha_locations l on l.id = s.location_id
       where s.id = $1
       limit 1`,
      [id],
    );
    return mapSession(rows[0]!);
  });
