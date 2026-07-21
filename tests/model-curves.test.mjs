import assert from "node:assert/strict";
import test from "node:test";
import { getOccupation } from "../app/model.ts";

test("wage curves have pronounced growth and decline phases", () => {
  const founder = getOccupation("founder");
  const athlete = getOccupation("athlete");
  const listed = getOccupation("listedGeneral");

  assert.ok(founder.rampUp[0] >= .14);
  assert.ok(founder.rampDown[1] <= -.14);
  assert.ok(athlete.rampUp[0] >= .20);
  assert.ok(athlete.rampDown[1] <= -.38);
  assert.ok(listed.rampUp[0] >= .045);
  assert.ok(listed.rampDown[1] <= -.05);
});

test("nightlife occupations receive extreme appearance sensitivity", () => {
  assert.equal(getOccupation("host").appearanceMultiplier, 8);
  assert.equal(getOccupation("hostess").appearanceMultiplier, 8);
  assert.equal(getOccupation("clubOwner").appearanceMultiplier, 4);
});
