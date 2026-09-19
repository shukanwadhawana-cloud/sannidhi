import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSelfCancel, validateRequestDraft } from "./request-rules.ts";

describe("validateRequestDraft", () => {
  it("requires a real reason", () => {
    const err = validateRequestDraft({
      requestType: "leave",
      dayDate: "2026-09-17",
      reason: "away",
    });
    assert.equal(err, "Please explain in at least a short sentence.");
  });

  it("requires a session for regularize", () => {
    const err = validateRequestDraft({
      requestType: "regularize",
      dayDate: "2026-09-17",
      reason: "Forgot to punch in after arriving.",
    });
    assert.equal(err, "Choose the Sabha you need regularized.");
  });

  it("accepts a complete regularize draft", () => {
    const err = validateRequestDraft({
      requestType: "regularize",
      sessionId: "s1",
      dayDate: "2026-09-17",
      requestedPunchIn: "2026-09-17T08:05:00+05:30",
      requestedPunchOut: "2026-09-17T10:00:00+05:30",
      reason: "Phone died before I could punch in.",
    });
    assert.equal(err, null);
  });

  it("blocks inverted times", () => {
    const err = validateRequestDraft({
      requestType: "regularize",
      sessionId: "s1",
      dayDate: "2026-09-17",
      requestedPunchIn: "2026-09-17T10:00:00+05:30",
      requestedPunchOut: "2026-09-17T08:00:00+05:30",
      reason: "Phone died before I could punch in.",
    });
    assert.equal(err, "Exit time cannot be before entry time.");
  });
});

describe("canSelfCancel", () => {
  it("only pending requests can be withdrawn", () => {
    assert.equal(canSelfCancel("pending"), true);
    assert.equal(canSelfCancel("approved"), false);
  });
});
