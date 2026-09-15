import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  DEFAULT_CENTRE_ID,
  DEFAULT_LOCATION_ID,
  DEFAULT_ORG_ID,
  DEFAULT_TIMEZONE,
} from "@/lib/constants";
import { getSql } from "@/lib/db";
import { weekdayName, ymdInZone } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { mapProfile } from "./map";

type Sql = Awaited<ReturnType<typeof getSql>>;

async function loadAuthUser(sql: Sql, userId: string) {
  const rows = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? { name: "Satsangi", email: "" };
}

function istParts(now = new Date()) {
  const date = ymdInZone(now, DEFAULT_TIMEZONE);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DEFAULT_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const minute = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DEFAULT_TIMEZONE,
      minute: "numeric",
    }).format(now),
  );
  return { date, hour, minute };
}

function isoInIst(date: string, hour: number, minute: number): string {
  const hh = String(Math.max(0, Math.min(23, hour))).padStart(2, "0");
  const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, "0");
  return `${date}T${hh}:${mm}:00+05:30`;
}

async function ensureOpenDemoSession(sql: Sql, createdBy: string): Promise<void> {
  const open = await sql<{ id: string }>`
    select s.id
    from sabha_sessions s
    where s.organization_id = ${DEFAULT_ORG_ID}
      and s.status <> 'cancelled'
      and now() >= s.punch_in_open_time
      and now() <= s.scheduled_end
    limit 1
  `;
  if (open.length > 0) return;

  const loc = await sql<{ id: string }>`
    select id from sabha_locations where id = ${DEFAULT_LOCATION_ID} limit 1
  `;
  if (loc.length === 0) return;

  const { date, hour } = istParts();
  const startHour = Math.max(6, hour - 1);
  const endHour = Math.min(22, Math.max(startHour + 4, hour + 3));
  const name = `${weekdayName()} Sabha`;
  await sql`
    insert into sabha_sessions (
      id, organization_id, location_id, name, session_date,
      scheduled_start, scheduled_end, punch_in_open_time, punch_in_close_time,
      status, allow_location_exceptions, allow_out_of_geofence_punch_out, created_by
    ) values (
      ${crypto.randomUUID()},
      ${DEFAULT_ORG_ID},
      ${DEFAULT_LOCATION_ID},
      ${name},
      ${date},
      ${isoInIst(date, startHour, 0)},
      ${isoInIst(date, endHour, 0)},
      ${isoInIst(date, Math.max(5, startHour - 1), 30)},
      ${isoInIst(date, endHour, 0)},
      'open',
      true,
      true,
      ${createdBy}
    )
  `;
}

export async function ensureProfile(userId: string): Promise<Profile> {
  const sql = await getSql();
  const existing = await sql<Record<string, unknown>>`
    select * from profiles where user_id = ${userId} limit 1
  `;
  if (existing[0]) {
    await ensureOpenDemoSession(sql, userId);
    return mapProfile(existing[0]);
  }

  const authUser = await loadAuthUser(sql, userId);
  const superRows = await sql<{ c: number }>`
    select count(*)::int as c from profiles where role = 'super_admin'
  `;
  const isFirst = (superRows[0]?.c ?? 0) === 0;
  const role = isFirst ? "super_admin" : "satsangi";

  await sql`
    insert into profiles (
      user_id, organization_id, centre_id, full_name, email, role, status
    ) values (
      ${userId},
      ${DEFAULT_ORG_ID},
      ${DEFAULT_CENTRE_ID},
      ${authUser.name || "Satsangi"},
      ${authUser.email || null},
      ${role},
      'active'
    )
    on conflict (user_id) do nothing
  `;

  await ensureOpenDemoSession(sql, userId);

  const created = await sql<Record<string, unknown>>`
    select * from profiles where user_id = ${userId} limit 1
  `;
  if (!created[0]) throw new Error("Could not create a profile.");
  return mapProfile(created[0]);
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return ensureProfile(context.userId);
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { fullName: string; mobile?: string; memberId?: string }) => {
    const fullName = (d.fullName ?? "").trim();
    if (fullName.length < 2) throw new Error("Please enter your full name.");
    return {
      fullName: fullName.slice(0, 80),
      mobile: (d.mobile ?? "").trim().slice(0, 20) || null,
      memberId: (d.memberId ?? "").trim().slice(0, 40) || null,
    };
  })
  .handler(async ({ context, data }) => {
    const profile = await ensureProfile(context.userId);
    const sql = await getSql();
    await sql`
      update profiles
      set full_name = ${data.fullName},
          mobile = ${data.mobile},
          member_id = ${data.memberId},
          updated_at = now()
      where user_id = ${profile.userId}
    `;
    return ensureProfile(context.userId);
  });
