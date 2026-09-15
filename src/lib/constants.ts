export const APP_NAME = "Sannidhi";
export const APP_TAGLINE = "Sabha attendance, simply.";
export const DEFAULT_ORG_ID = "org_sannidhi";
export const DEFAULT_CENTRE_ID = "centre_main";
export const DEFAULT_LOCATION_ID = "loc_main_hall";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const ROLES = ["satsangi", "coordinator", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const RADIUS_OPTIONS = [50, 100, 200, 500, 1000] as const;

export const STAFF_ROLES: Role[] = ["coordinator", "admin", "super_admin"];
export const ADMIN_ROLES: Role[] = ["admin", "super_admin"];
