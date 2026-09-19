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

export type OrgPolicy = {
  graceMinutes: number;
};

export type RequestType = "regularize" | "not_attending" | "leave";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AttendanceRequest = {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  sessionId: string | null;
  sessionName?: string | null;
  locationName?: string | null;
  dayDate: string;
  requestType: RequestType;
  status: RequestStatus;
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  reviewerUserId: string | null;
  reviewerName?: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  mark: "none" | "open" | "present" | "leave" | "not_attending" | "absent";
  sessionCount: number;
  present: boolean;
};

export type MonthDesk = {
  year: number;
  month: number;
  days: CalendarDay[];
  summary: {
    presentDays: number;
    leaveDays: number;
    absentDays: number;
    sabhaDays: number;
  };
};

export type TeamMember = {
  profile: Profile;
  status: "present" | "completed" | "leave" | "not_in" | "exception";
  punchInTime: string | null;
  punchOutTime: string | null;
  durationSeconds: number | null;
  isLate: boolean;
  hasLocationException: boolean;
};

export type TeamRoster = {
  session: SabhaSession | null;
  members: TeamMember[];
  counts: {
    present: number;
    completed: number;
    leave: number;
    notIn: number;
    exceptions: number;
    total: number;
  };
};

export type HomeData = {
  profile: Profile;
  session: SabhaSession | null;
  attendance: AttendanceRecord | null;
  recent: AttendanceRecord[];
  stats: {
    presentCount: number;
    totalSessions: number;
  };
  policy: OrgPolicy;
  pendingRequestCount: number;
  month: {
    presentDays: number;
    leaveDays: number;
    sabhaDays: number;
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
  pendingApprovals: number;
  onLeaveToday: number;
  memberCount: number;
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
