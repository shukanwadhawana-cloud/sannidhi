import type { Role } from "./constants";

export type Profile = {
  userId: string;
  organizationId: string;
  centreId: string | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  memberId: string | null;
  role: Role;
  status: "active" | "inactive";
};

export type SabhaLocation = {
  id: string;
  organizationId: string;
  centreId: string;
  name: string;
  address: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  isActive: boolean;
};

export type SabhaSession = {
  id: string;
  organizationId: string;
  locationId: string;
  name: string;
  sessionDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  punchInOpenTime: string;
  punchInCloseTime: string;
  punchOutCloseTime: string | null;
  status: "scheduled" | "open" | "closed" | "cancelled";
  allowLocationExceptions: boolean;
  allowOutOfGeofencePunchOut: boolean;
  locationName?: string;
  locationAddress?: string | null;
  latitude?: number;
  longitude?: number;
  allowedRadiusMeters?: number;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  sessionId: string;
  locationId: string;
  status: "active" | "completed" | "cancelled";
  punchInTime: string | null;
  punchOutTime: string | null;
  punchInDistance: number | null;
  punchOutDistance: number | null;
  punchInAccuracy: number | null;
  punchOutAccuracy: number | null;
  durationSeconds: number | null;
  isLate: boolean;
  hasLocationException: boolean;
  missingPunchOut: boolean;
  userName?: string;
  sessionName?: string;
  locationName?: string;
  sessionDate?: string;
};

export type PunchFailureCode =
  | "NO_SESSION"
  | "WINDOW_CLOSED"
  | "ALREADY_IN"
  | "NOT_CHECKED_IN"
  | "ALREADY_OUT"
  | "OUTSIDE_GEOFENCE"
  | "GPS_INACCURATE"
  | "LOCATION_MISSING"
  | "RATE_LIMIT"
  | "INACTIVE"
  | "OFFLINE";

export type PunchOk = {
  ok: true;
  record: AttendanceRecord;
  geofenceVerdict: string;
  exception: boolean;
};

export type PunchFail = {
  ok: false;
  code: PunchFailureCode;
  message: string;
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  canRetryWithException?: boolean;
};

export type PunchResult = PunchOk | PunchFail;

export type HomeData = {
  profile: Profile;
  session: SabhaSession | null;
  attendance: AttendanceRecord | null;
  recent: AttendanceRecord[];
  stats: {
    presentCount: number;
    totalSessions: number;
  };
};

export type AdminOverview = {
  profile: Profile;
  todaySessions: number;
  checkedIn: number;
  checkedOut: number;
  currentlyPresent: number;
  locationExceptions: number;
  lateArrivals: number;
  sessions: Array<{
    session: SabhaSession;
    present: number;
    completed: number;
    exceptions: number;
  }>;
};

export type PlaceHit = {
  label: string;
  latitude: number;
  longitude: number;
};
