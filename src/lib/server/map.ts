import type { Role } from "@/lib/constants";
import { asBool, asIso, asNumber } from "@/lib/format";
import type { AttendanceRecord, Profile, SabhaLocation, SabhaSession } from "@/lib/types";

export function mapProfile(row: Record<string, unknown>): Profile {
  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    centreId: row.centre_id ? String(row.centre_id) : null,
    fullName: String(row.full_name ?? ""),
    email: row.email ? String(row.email) : null,
    mobile: row.mobile ? String(row.mobile) : null,
    memberId: row.member_id ? String(row.member_id) : null,
    role: String(row.role) as Role,
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

export function mapLocation(row: Record<string, unknown>): SabhaLocation {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    centreId: String(row.centre_id),
    name: String(row.name),
    address: row.address ? String(row.address) : null,
    description: row.description ? String(row.description) : null,
    latitude: asNumber(row.latitude) ?? 0,
    longitude: asNumber(row.longitude) ?? 0,
    allowedRadiusMeters: asNumber(row.allowed_radius_meters) ?? 100,
    isActive: asBool(row.is_active),
  };
}

export function mapSession(row: Record<string, unknown>): SabhaSession {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    locationId: String(row.location_id),
    name: String(row.name),
    sessionDate: String(row.session_date).slice(0, 10),
    scheduledStart: asIso(row.scheduled_start) ?? "",
    scheduledEnd: asIso(row.scheduled_end) ?? "",
    punchInOpenTime: asIso(row.punch_in_open_time) ?? "",
    punchInCloseTime: asIso(row.punch_in_close_time) ?? "",
    punchOutCloseTime: asIso(row.punch_out_close_time),
    status: (row.status as SabhaSession["status"]) ?? "scheduled",
    allowLocationExceptions: asBool(row.allow_location_exceptions),
    allowOutOfGeofencePunchOut: asBool(row.allow_out_of_geofence_punch_out),
    locationName: row.location_name ? String(row.location_name) : undefined,
    locationAddress: row.location_address ? String(row.location_address) : null,
    latitude: asNumber(row.latitude) ?? undefined,
    longitude: asNumber(row.longitude) ?? undefined,
    allowedRadiusMeters: asNumber(row.allowed_radius_meters) ?? undefined,
  };
}

export function mapAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: String(row.session_id),
    locationId: String(row.location_id),
    status: (row.status as AttendanceRecord["status"]) ?? "active",
    punchInTime: asIso(row.punch_in_time),
    punchOutTime: asIso(row.punch_out_time),
    punchInDistance: asNumber(row.punch_in_distance_from_location),
    punchOutDistance: asNumber(row.punch_out_distance_from_location),
    punchInAccuracy: asNumber(row.punch_in_accuracy),
    punchOutAccuracy: asNumber(row.punch_out_accuracy),
    durationSeconds: asNumber(row.duration_seconds),
    isLate: asBool(row.is_late),
    hasLocationException: asBool(row.has_location_exception),
    missingPunchOut: asBool(row.missing_punch_out),
    userName: row.full_name ? String(row.full_name) : row.user_name ? String(row.user_name) : undefined,
    sessionName: row.session_name ? String(row.session_name) : undefined,
    locationName: row.location_name ? String(row.location_name) : undefined,
    sessionDate: row.session_date ? String(row.session_date).slice(0, 10) : undefined,
  };
}

export async function writeAudit(
  sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>,
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string | null;
  },
): Promise<void> {
  await sql`
    insert into audit_logs (
      id, organization_id, actor_user_id, action, entity_type, entity_id, old_value, new_value, reason
    ) values (
      ${crypto.randomUUID()},
      ${input.organizationId},
      ${input.actorUserId},
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.oldValue == null ? null : JSON.stringify(input.oldValue)},
      ${input.newValue == null ? null : JSON.stringify(input.newValue)},
      ${input.reason ?? null}
    )
  `;
}
