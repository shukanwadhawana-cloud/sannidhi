import { getSql } from "@/lib/db";
import type { OrgPolicy } from "@/lib/types";

type Sql = Awaited<ReturnType<typeof getSql>>;

export async function loadOrgPolicy(sql: Sql, organizationId: string): Promise<OrgPolicy> {
  const rows = await sql<{ grace_minutes: number }>`
    select grace_minutes from organizations where id = ${organizationId} limit 1
  `;
  const n = Number(rows[0]?.grace_minutes ?? 10);
  return { graceMinutes: Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : 10 };
}
