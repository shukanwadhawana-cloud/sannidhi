import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canChangeRole, canCorrectAttendance, canManageLocations, isAdmin, isStaff } from "./roles.ts";

describe("role authorization", () => {
  it("does not treat a satsangi as staff", () => {
    assert.equal(isStaff("satsangi"), false);
    assert.equal(isAdmin("satsangi"), false);
    assert.equal(canManageLocations("satsangi"), false);
    assert.equal(canCorrectAttendance("satsangi"), false);
  });

  it("lets coordinators correct attendance but not manage locations", () => {
    assert.equal(isStaff("coordinator"), true);
    assert.equal(canCorrectAttendance("coordinator"), true);
    assert.equal(canManageLocations("coordinator"), false);
  });

  it("prevents admins from minting super_admin", () => {
    assert.equal(canChangeRole("admin", "super_admin"), false);
    assert.equal(canChangeRole("super_admin", "admin"), true);
  });
});
