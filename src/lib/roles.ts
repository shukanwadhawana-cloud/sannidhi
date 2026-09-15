import type { Role } from "./constants";
import { ADMIN_ROLES, STAFF_ROLES } from "./constants";
import type { Profile } from "./types";

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageLocations(role: Role): boolean {
  return isAdmin(role);
}

export function canManageSessions(role: Role): boolean {
  return isStaff(role);
}

export function canManagePeople(role: Role): boolean {
  return isAdmin(role);
}

export function canCorrectAttendance(role: Role): boolean {
  return isStaff(role);
}

export function canViewReports(role: Role): boolean {
  return isStaff(role);
}

export function canViewAudit(role: Role): boolean {
  return isAdmin(role);
}

export function canChangeRole(actor: Role, target: Role): boolean {
  if (actor === "super_admin") return true;
  if (actor === "admin") return target !== "super_admin";
  return false;
}

export function assertStaff(profile: Profile): void {
  if (!isStaff(profile.role) || profile.status !== "active") {
    throw Object.assign(new Error("You do not have access to this area."), { status: 403 });
  }
}

export function assertAdmin(profile: Profile): void {
  if (!isAdmin(profile.role) || profile.status !== "active") {
    throw Object.assign(new Error("Administrator access is required."), { status: 403 });
  }
}

export function assertActive(profile: Profile): void {
  if (profile.status !== "active") {
    throw Object.assign(new Error("This account is inactive."), { status: 403 });
  }
}
