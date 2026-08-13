import assert from "node:assert/strict";
import test from "node:test";
import { OCCUPATIONS, getOccupation, occupationIncomeFloor } from "../app/model.ts";

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
  assert.equal(OCCUPATIONS.length, 60);
  for (const key of [
    "software", "aiEngineer", "foreignTech", "influencer", "unemployed", "homemaker",
    "proGamer", "comedian", "mangaArtist", "voiceActor", "nurse", "childcare",
    "fullTimeTrader", "boatCycleRacer", "boardGamePro", "bureaucrat", "politician",
    "pilot", "cabinCrew", "beautician", "farmerFisher", "monk", "sumo",
    "traditionalActor", "sexWorker", "nightlifeFreelance", "angelInvestor",
    "reseller", "pokerLive", "pokerOnline", "slotProfessional",
  ]) assert.equal(getOccupation(key).key, key);
  assert.equal(getOccupation("professionalGambler").label, "プロギャンブラー（競馬・スポーツベット等）");
  assert.equal(getOccupation("slotProfessional").label, "スロット専業");
  assert.equal(getOccupation("nightlifeFreelance").label, "港区フリーランス");
});

test("every occupation has an age-adjusted income floor without spouse credit", () => {
  for (const occupation of OCCUPATIONS) {
    assert.ok(Number.isFinite(occupationIncomeFloor(occupation, 35)), occupation.key);
  }
  assert.equal(occupationIncomeFloor(getOccupation("homemaker"), 35), 500);
  assert.equal(getOccupation("homemaker").specialNote?.includes("配偶者の収入・与信は含めません"), true);
  assert.equal(occupationIncomeFloor(getOccupation("unemployed"), 35), 0);
});

test("nightlife occupations receive extreme appearance sensitivity", () => {
  assert.equal(getOccupation("host").appearanceMultiplier, 8);
  assert.equal(getOccupation("hostess").appearanceMultiplier, 8);
  assert.equal(getOccupation("clubOwner").appearanceMultiplier, 4);
  assert.equal(getOccupation("sexWorker").appearanceMultiplier, 10);
  assert.equal(getOccupation("nightlifeFreelance").appearanceMultiplier, 9);
});
