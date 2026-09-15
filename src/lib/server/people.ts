import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { assertAdmin, assertStaff, canChangeRole } from "@/lib/roles";
import type { Profile } from "@/lib/types";
import { mapProfile, writeAudit } from "./map";
import { ensureProfile } from "./profile";

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile[]> => {
    const actor = await ensureProfile(context.userId);
    assertStaff(actor);
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from profiles
      where organization_id = ${actor.organizationId}
      order by full_name asc
    `;
    return rows.map(mapProfile);
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; role?: Role; status?: "active" | "inactive"; mobile?: string; memberId?: string }) => {
    if (!d.userId) throw new Error("A person is required.");
    if (d.role && !ROLES.includes(d.role)) throw new Error("That role is not valid.");
    return d;
  })
  .handler(async ({ context, data }) => {
    const actor = await ensureProfile(context.userId);
    assertAdmin(actor);
    if (data.userId === actor.userId && data.status === "inactive") {
      throw new Error("You cannot deactivate your own account.");
    }
    const sql = await getSql();
    const prev = await sql<Record<string, unknown>>`
      select * from profiles where user_id = ${data.userId} and organization_id = ${actor.organizationId} limit 1
    `;
    if (!prev[0]) throw new Error("Person not found.");
    const current = mapProfile(prev[0]);
    if (data.role && !canChangeRole(actor.role, data.role)) {
      throw new Error("You cannot assign that role.");
    }
    if (data.role && current.role === "super_admin" && actor.role !== "super_admin") {
      throw new Error("Only a super administrator can change that account.");
    }

    await sql`
      update profiles
      set role = ${data.role ?? current.role},
          status = ${data.status ?? current.status},
          mobile = ${data.mobile ?? current.mobile},
          member_id = ${data.memberId ?? current.memberId},
          updated_at = now()
      where user_id = ${data.userId}
    `;
    await writeAudit(sql, {
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "update_person",
      entityType: "profile",
      entityId: data.userId,
      oldValue: current,
      newValue: data,
    });
    const rows = await sql<Record<string, unknown>>`
      select * from profiles where user_id = ${data.userId} limit 1
    `;
    return mapProfile(rows[0]!);
  });
