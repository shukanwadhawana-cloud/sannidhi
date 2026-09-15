import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPunchRateLimit,
  durationSeconds,
  evaluatePunchInWindow,
  evaluatePunchOutWindow,
  isLate,
  resetPunchRateLimit,
} from "./punch-rules.ts";

function sessionAround(now: Date) {
  const t = now.getTime();
  return {
    punchInOpen: new Date(t - 30 * 60_000),
    punchInClose: new Date(t + 30 * 60_000),
    scheduledStart: new Date(t),
    scheduledEnd: new Date(t + 2 * 60 * 60_000),
    punchOutClose: new Date(t + 3 * 60 * 60_000),
    status: "open" as const,
  };
}

describe("evaluatePunchInWindow", () => {
  const now = new Date("2026-09-13T08:04:00+05:30");

  it("allows punch-in inside the window", () => {
    assert.equal(evaluatePunchInWindow(now, sessionAround(now)), "ok");
  });

  it("blocks punch-in before the window opens", () => {
    const s = sessionAround(now);
    s.punchInOpen = new Date(now.getTime() + 10 * 60_000);
    assert.equal(evaluatePunchInWindow(now, s), "not_yet_open");
  });

  it("blocks punch-in after close", () => {
    const s = sessionAround(now);
    s.punchInClose = new Date(now.getTime() - 60_000);
    s.scheduledEnd = new Date(now.getTime() + 60 * 60_000);
    assert.equal(evaluatePunchInWindow(now, s), "punch_in_closed");
  });

  it("blocks cancelled sessions", () => {
    const s = { ...sessionAround(now), status: "cancelled" as const };
    assert.equal(evaluatePunchInWindow(now, s), "cancelled");
  });
});

describe("evaluatePunchOutWindow", () => {
  it("allows punch-out after scheduled end within grace", () => {
    const now = new Date("2026-09-13T11:00:00+05:30");
    const s = sessionAround(new Date("2026-09-13T08:00:00+05:30"));
    assert.equal(evaluatePunchOutWindow(now, s), "ok");
  });
});

describe("isLate / duration", () => {
  it("marks arrival more than a minute after start as late", () => {
    const start = new Date("2026-09-13T08:00:00+05:30");
    assert.equal(isLate(new Date("2026-09-13T08:04:00+05:30"), start), true);
    assert.equal(isLate(new Date("2026-09-13T08:00:30+05:30"), start), false);
  });

  it("formats duration in whole seconds", () => {
    const a = new Date("2026-09-13T08:04:00Z");
    const b = new Date("2026-09-13T10:21:00Z");
    assert.equal(durationSeconds(a, b), 2 * 3600 + 17 * 60);
  });
});

describe("checkPunchRateLimit", () => {
  it("trips after too many punches", () => {
    resetPunchRateLimit();
    for (let i = 0; i < 8; i++) assert.equal(checkPunchRateLimit("u1", 1_000 + i), true);
    assert.equal(checkPunchRateLimit("u1", 1_010), false);
    assert.equal(checkPunchRateLimit("u2", 1_010), true);
  });
});
