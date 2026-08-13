import assert from "node:assert/strict";
import test from "node:test";
import {
  EDUCATIONS,
  getEducation,
  normalizeEducationKey,
  resolveEducationKey,
} from "../app/model.ts";

test("master and doctor education options are merged into graduate", () => {
  assert.equal(EDUCATIONS.some((item) => item.key === "tokyoKyotoGraduate"), true);
  assert.equal(EDUCATIONS.some((item) => item.key === "eliteGraduate"), true);
  assert.equal(EDUCATIONS.some((item) => item.key === "tokyoKyotoDoctor"), false);
  assert.equal(EDUCATIONS.some((item) => item.key === "tokyoKyotoMaster"), false);
  assert.equal(EDUCATIONS.some((item) => item.key === "eliteDoctor"), false);
  assert.equal(EDUCATIONS.some((item) => item.key === "eliteMaster"), false);
  assert.match(getEducation("tokyoKyotoGraduate").label, /修士・博士/);
  assert.match(getEducation("eliteGraduate").label, /修士・博士/);
  assert.match(getEducation("sokeiGraduate").label, /修士・博士/);
});

test("legacy education keys resolve to merged graduate options", () => {
  assert.equal(resolveEducationKey("tokyoKyotoDoctor"), "tokyoKyotoGraduate");
  assert.equal(resolveEducationKey("tokyoKyotoMaster"), "tokyoKyotoGraduate");
  assert.equal(resolveEducationKey("eliteDoctor"), "eliteGraduate");
  assert.equal(resolveEducationKey("eliteMaster"), "eliteGraduate");
  assert.equal(normalizeEducationKey("tokyoKyotoDoctor"), "tokyoKyotoGraduate");
  assert.equal(getEducation("tokyoKyotoDoctor").key, "tokyoKyotoGraduate");
  assert.equal(resolveEducationKey("not-a-real-school"), null);
});
