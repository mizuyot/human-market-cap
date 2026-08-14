import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMENT_CATALOG,
  assertCatalogIntegrity,
  computeCommentLabels,
  selectResultComments,
} from "../app/comment-catalog/index.ts";
import { getOccupation } from "../app/model.ts";

function baseInput(overrides = {}) {
  const occ = getOccupation("listedGeneral");
  return {
    age: 30,
    annualIncome: 600,
    education: "university",
    appearance: "middle",
    occupation: "listedGeneral",
    financialAssets: 300,
    realEstateAssets: 0,
    otherAssets: 0,
    reinvestmentRate: 0.2,
    quizCorrect: 3,
    wrongQuizIds: ["q03", "q04"],
    quizSetIds: ["q01", "q03", "q04", "q05", "q06"],
    marketCapMan: 12000,
    salaryIncomeMan: 9000,
    assetIncomeMan: 500,
    careerOptionMan: 200,
    yearsRemaining: 35,
    occupationPeak: occ.peak,
    occupationPrimaryEnd: occ.primaryEnd,
    occupationCareerRisk: occ.careerRisk,
    occupationRetirement: occ.retirement,
    rankingTopPercent: 40,
    rankingDeviation: 52,
    previousScoreYen: null,
    scoreYen: 120_000_000,
    ...overrides,
  };
}

test("catalog has exactly 86 unique entries", () => {
  assertCatalogIntegrity();
  assert.equal(COMMENT_CATALOG.length, 86);
  assert.equal(new Set(COMMENT_CATALOG.map((e) => e.id)).size, 86);
});

test("selectResultComments returns 4 comments for a sample profile", () => {
  const comments = selectResultComments(baseInput());
  assert.equal(comments.length, 4);
  assert.ok(comments.every((c) => c.title && c.body));
  assert.equal(comments[0].slot === "special" || comments[0].slot === "headline", true);
  assert.equal(comments[1].slot, "career");
  assert.equal(comments[2].slot, "capital");
  assert.equal(comments[3].slot, "insight");
});

test("same input yields the same comment ids", () => {
  const a = selectResultComments(baseInput());
  const b = selectResultComments(baseInput());
  assert.deepEqual(
    a.map((c) => c.id),
    b.map((c) => c.id),
  );
});

test("changing quizCorrect can change insight id", () => {
  const steady = selectResultComments(baseInput({ quizCorrect: 3, wrongQuizIds: ["q03"] }));
  const master = selectResultComments(
    baseInput({ quizCorrect: 5, wrongQuizIds: [] }),
  );
  assert.notEqual(steady[3].id, master[3].id);
  assert.ok(master[3].id.startsWith("quiz-master-"));
});

test("extreme risk occupation uses risk-extreme not career-runway", () => {
  const occ = getOccupation("professionalGambler");
  assert.ok(occ.careerRisk > 0.06, "expected extreme careerRisk");
  const comments = selectResultComments(
    baseInput({
      occupation: "professionalGambler",
      occupationPeak: occ.peak,
      occupationPrimaryEnd: occ.primaryEnd,
      occupationCareerRisk: occ.careerRisk,
      occupationRetirement: occ.retirement,
      age: 28,
      yearsRemaining: 37,
    }),
  );
  const labels = computeCommentLabels(
    baseInput({
      occupation: "professionalGambler",
      occupationPeak: occ.peak,
      occupationPrimaryEnd: occ.primaryEnd,
      occupationCareerRisk: occ.careerRisk,
      occupationRetirement: occ.retirement,
      age: 28,
      yearsRemaining: 37,
    }),
  );
  assert.equal(labels.riskBucket, "extreme");
  assert.ok(comments[1].id.startsWith("risk-extreme-"));
  assert.ok(!comments[1].id.startsWith("career-"));
});

test("hidden title gekokujo when middleSchool + fund", () => {
  const comments = selectResultComments(
    baseInput({
      education: "middleSchool",
      occupation: "fund",
    }),
  );
  assert.equal(comments[0].slot, "special");
  assert.equal(comments[0].id, "title-gekokujo");
  assert.match(comments[0].title, /下剋上/);
});
