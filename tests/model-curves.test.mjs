import assert from "node:assert/strict";
import test from "node:test";
import { OCCUPATIONS, getOccupation } from "../app/model.ts";

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

test("hedge funds and AI engineering use intentionally extreme growth", () => {
  const fund = getOccupation("fund");
  const ai = getOccupation("aiEngineer");

  assert.ok(fund.rampUp[0] >= .35);
  assert.ok(fund.rampUp[1] >= .20);
  assert.equal(ai.specialGrowthYears, 5);
  assert.ok((ai.specialGrowthRate ?? 0) >= .30);
  assert.ok(ai.rampUp[0] + (ai.specialGrowthRate ?? 0) > fund.rampUp[0]);
});

test("expanded occupation catalog includes all requested culture segments", () => {
  assert.equal(OCCUPATIONS.length, 55);
  for (const key of [
    "software", "aiEngineer", "foreignTech", "influencer", "unemployed", "homemaker",
    "proGamer", "comedian", "mangaArtist", "voiceActor", "nurse", "childcare",
    "fullTimeTrader", "boatCycleRacer", "boardGamePro", "bureaucrat", "politician",
    "pilot", "cabinCrew", "beautician", "farmerFisher", "monk", "sumo",
    "traditionalActor", "sexWorker", "nightlifeFreelance",
  ]) assert.equal(getOccupation(key).key, key);
});

test("nightlife occupations receive extreme appearance sensitivity", () => {
  assert.equal(getOccupation("host").appearanceMultiplier, 8);
  assert.equal(getOccupation("hostess").appearanceMultiplier, 8);
  assert.equal(getOccupation("clubOwner").appearanceMultiplier, 4);
  assert.equal(getOccupation("sexWorker").appearanceMultiplier, 10);
  assert.equal(getOccupation("nightlifeFreelance").appearanceMultiplier, 9);
});
