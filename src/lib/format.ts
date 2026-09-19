import { DEFAULT_TIMEZONE } from "./constants";

export function asIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export function formatTime(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDate(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatDateLong(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function greetingFor(now = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hour12: false }).format(now),
  );
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function weekdayName(now = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "long" }).format(now);
}

export function ymdInZone(now = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  const part = full.trim().split(/\s+/)[0];
  return part || "there";
}

export function formatClockParts(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const dayPeriod = (get("dayPeriod") || "AM").replace(/\./g, "").toUpperCase();
  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    dayPeriod,
    dateLabel: `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`,
  };
}

export function requestTypeLabel(type: string): string {
  switch (type) {
    case "regularize":
      return "Regularize";
    case "not_attending":
      return "Not attending";
    case "leave":
      return "Leave";
    default:
      return type;
  }
}

export function requestStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Declined";
    case "cancelled":
      return "Withdrawn";
    default:
      return status;
  }
}

export function formatMeters(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 10) return `${n.toFixed(1)} m`;
  return `${Math.round(n)} m`;
}

export function roleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super administrator";
    case "admin":
      return "Administrator";
    case "coordinator":
      return "Coordinator";
    default:
      return "Satsangi";
  }
}

export function isoToIstInput(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: ymdInZone(), time: "08:00" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: ymdInZone(), time: "08:00" };
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "08";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { date, time: `${hour}:${minute}` };
}

export function istInputToIso(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}+05:30`;
}
