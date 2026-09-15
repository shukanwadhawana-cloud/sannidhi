import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGeofence, haversineMeters } from "./geo.ts";

describe("haversineMeters", () => {
  it("returns ~0 for identical coordinates", () => {
    const d = haversineMeters(19.076, 72.8777, 19.076, 72.8777);
    assert.ok(d < 0.01);
  });

  it("measures ~100m for 0.0009° of latitude", () => {
    // 1° latitude ≈ 111_320 m, so 0.0009° ≈ 100.19 m
    const d = haversineMeters(0, 0, 0.0009, 0);
    assert.ok(Math.abs(d - 100.19) < 1, `got ${d}`);
  });

  it("is symmetric", () => {
    const a = haversineMeters(19.076, 72.8777, 19.08, 72.88);
    const b = haversineMeters(19.08, 72.88, 19.076, 72.8777);
    assert.ok(Math.abs(a - b) < 0.001);
  });

  it("treats a known 1km-ish Mumbai offset as outside 100m", () => {
    // ~0.009° lat ≈ 1 km
    const d = haversineMeters(19.076, 72.8777, 19.085, 72.8777);
    assert.ok(d > 900 && d < 1100, `got ${d}`);
  });
});

describe("evaluateGeofence", () => {
  const sabha = { sabhaLat: 19.076, sabhaLng: 72.8777, radiusMeters: 100 };

  it("allows a point well inside the radius", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: 19.0761,
      userLng: 72.8777,
      accuracy: 10,
      allowExceptions: false,
    });
    assert.equal(r.verdict, "inside");
    assert.equal(r.canProceed, true);
    assert.equal(r.isException, false);
    assert.ok((r.distanceMeters ?? 99) < 50);
  });

  it("rejects a point clearly outside the radius", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: 19.08,
      userLng: 72.8777,
      accuracy: 10,
      allowExceptions: false,
    });
    assert.equal(r.verdict, "outside");
    assert.equal(r.canProceed, false);
    assert.equal(r.isException, true);
  });

  it("allows an outside punch-out when configured", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: 19.08,
      userLng: 72.8777,
      accuracy: 10,
      allowExceptions: false,
      allowOutside: true,
    });
    assert.equal(r.verdict, "outside");
    assert.equal(r.canProceed, true);
    assert.equal(r.isException, true);
  });

  it("treats GPS slack as borderline, not a hard deny", () => {
    // ~120 m away with 40 m accuracy → still plausibly at the hall
    const r = evaluateGeofence({
      sabhaLat: 0,
      sabhaLng: 0,
      radiusMeters: 100,
      userLat: 0.00108,
      userLng: 0,
      accuracy: 40,
      allowExceptions: false,
    });
    assert.equal(r.verdict, "borderline");
    assert.equal(r.canProceed, true);
  });

  it("flags missing coordinates as an exception path", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: null,
      userLng: null,
      accuracy: null,
      allowExceptions: true,
    });
    assert.equal(r.verdict, "missing");
    assert.equal(r.canProceed, true);
    assert.equal(r.isException, true);
  });

  it("does not allow missing coordinates without exceptions", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: null,
      userLng: null,
      accuracy: null,
      allowExceptions: false,
    });
    assert.equal(r.canProceed, false);
  });

  it("flags extremely inaccurate GPS", () => {
    const r = evaluateGeofence({
      ...sabha,
      userLat: 19.076,
      userLng: 72.8777,
      accuracy: 2000,
      allowExceptions: false,
    });
    assert.equal(r.verdict, "inaccurate");
    assert.equal(r.canProceed, false);
  });
});
