import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDay, monthGrid, shiftMonth } from "./calendar.ts";

describe("classifyDay", () => {
  const base = {
    hasSession: true,
    isFuture: false,
    isToday: false,
    hasPresent: false,
    hasLeave: false,
    hasNotAttending: false,
  };

  it("marks past session without punch as absent", () => {
    assert.equal(classifyDay(base), "absent");
  });

  it("marks presence", () => {
    assert.equal(classifyDay({ ...base, hasPresent: true }), "present");
  });

  it("lets leave win over presence", () => {
    assert.equal(classifyDay({ ...base, hasPresent: true, hasLeave: true }), "leave");
  });

  it("keeps today open until marked", () => {
    assert.equal(classifyDay({ ...base, isToday: true }), "open");
  });

  it("does not mark future empty days as absent", () => {
    assert.equal(classifyDay({ ...base, isFuture: true }), "none");
  });

  it("returns none when no session ran", () => {
    assert.equal(classifyDay({ ...base, hasSession: false }), "none");
  });
});

describe("monthGrid", () => {
  it("starts Monday for September 2026", () => {
    const cells = monthGrid(2026, 9);
    assert.equal(cells[0]?.date, "2026-08-31");
    assert.equal(cells.find((c) => c.date === "2026-09-01")?.inMonth, true);
    assert.equal(cells.length % 7, 0);
  });
});

describe("shiftMonth", () => {
  it("wraps December to January", () => {
    assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
    assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  });
});
