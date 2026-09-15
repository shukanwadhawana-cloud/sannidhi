export type SessionWindow = {
  punchInOpen: Date;
  punchInClose: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  punchOutClose: Date | null;
  status: "scheduled" | "open" | "closed" | "cancelled";
};

export type PunchWindowVerdict =
  | "ok"
  | "not_yet_open"
  | "punch_in_closed"
  | "session_ended"
  | "cancelled";

export function evaluatePunchInWindow(
  now: Date,
  session: SessionWindow,
): PunchWindowVerdict {
  if (session.status === "cancelled") return "cancelled";
  if (now < session.punchInOpen) return "not_yet_open";
  if (now > session.scheduledEnd && now > session.punchInClose) {
    return "session_ended";
  }
  if (now > session.punchInClose) return "punch_in_closed";
  return "ok";
}

export function evaluatePunchOutWindow(
  now: Date,
  session: SessionWindow,
): PunchWindowVerdict {
  if (session.status === "cancelled") return "cancelled";
  const close = session.punchOutClose ?? session.scheduledEnd;
  // Allow punch-out after the expected end so people who stay for
  // prasad / cleanup can still complete attendance. Only block if an
  // explicit punch-out close is in the past by a long margin (12h).
  const hardClose = new Date(close.getTime() + 12 * 60 * 60 * 1000);
  if (now > hardClose) return "session_ended";
  return "ok";
}

export function isLate(punchIn: Date, scheduledStart: Date): boolean {
  return punchIn.getTime() > scheduledStart.getTime() + 60_000;
}

export function durationSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export function describePunchWindow(verdict: PunchWindowVerdict): string {
  switch (verdict) {
    case "ok":
      return "";
    case "not_yet_open":
      return "Punch-in has not opened for this Sabha yet.";
    case "punch_in_closed":
      return "The punch-in window for this Sabha has closed.";
    case "session_ended":
      return "This Sabha session has ended.";
    case "cancelled":
      return "This Sabha session was cancelled.";
  }
}

const PUNCH_RATE_WINDOW_MS = 60_000;
const PUNCH_RATE_MAX = 8;
const punchHits = new Map<string, number[]>();

/** In-process rate limit. Best-effort; production can swap for Redis later. */
export function checkPunchRateLimit(userId: string, now = Date.now()): boolean {
  const cutoff = now - PUNCH_RATE_WINDOW_MS;
  const hits = (punchHits.get(userId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= PUNCH_RATE_MAX) {
    punchHits.set(userId, hits);
    return false;
  }
  hits.push(now);
  punchHits.set(userId, hits);
  return true;
}

export function resetPunchRateLimit(): void {
  punchHits.clear();
}
