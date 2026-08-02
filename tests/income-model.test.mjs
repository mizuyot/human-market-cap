import test from "node:test";
import assert from "node:assert/strict";
import { INFLATION_RATE } from "../app/calculation-policy.ts";
import { calculateMarketCap } from "../app/server/calculation.ts";

const base = {
  age: 30,
  annualIncome: 0,
  education: "university",
  appearance: "middle",
  occupation: "listedGeneral",
  financialAssets: 0,
  realEstateAssets: 0,
  otherAssets: 0,
  reinvestmentRate: 0,
  correctAnswers: 3,
};

test("very low current income recovers to the occupation floor from year two", () => {
  const result = calculateMarketCap(base);
  assert.equal(result.projections[0].rawSalary, 0);
  assert.equal(result.projections[1].rawSalary, result.occupationIncomeFloor);
});

test("income below the floor closes 35 percent of the remaining gap", () => {
  const result = calculateMarketCap({ ...base, annualIncome: 200 });
  const projectedWithoutFloor = 200 * (1 + result.projections[0].curveRate + INFLATION_RATE + result.nwSalaryAdjustment);
  const nextFloor = result.projections[1].rawSalary;
  assert.ok(nextFloor > projectedWithoutFloor);
  assert.ok(nextFloor < result.occupationIncomeFloor + 5);
});

test("post-career income follows a separate common transition path", () => {
  const result = calculateMarketCap({ ...base, age: 59, annualIncome: 1000, occupation: "fund" });
  assert.equal(result.projections[0].salary, 1000);
  assert.ok(Math.abs(result.projections[1].salary - result.transitionBaseIncome * (1 + INFLATION_RATE)) < .001);
  assert.ok(result.projections[1].salary < result.projections[1].rawSalary);
});

test("already past primaryEnd uses transition income from year one", () => {
  const result = calculateMarketCap({ ...base, age: 62, annualIncome: 1200, occupation: "fund" });
  assert.equal(result.projections[0].survival, 0);
  assert.ok(Math.abs(result.projections[0].salary - result.transitionBaseIncome) < .001);
  assert.ok(result.projections[0].salary < 1200);
});

test("unemployed does not receive common transition income", () => {
  const result = calculateMarketCap({
    ...base,
    annualIncome: 0,
    occupation: "unemployed",
    financialAssets: 10_000,
  });
  assert.equal(result.transitionBaseIncome, 0);
  for (const row of result.projections) {
    assert.equal(row.salary, 0);
    assert.equal(row.rawSalary, 0);
  }
  assert.equal(result.salaryIncomeMan, 0);
  assert.ok(result.assetIncomeMan > 0);
});

test("initial asset principal is included in market cap", () => {
  const result = calculateMarketCap({
    ...base,
    annualIncome: 0,
    occupation: "unemployed",
    financialAssets: 5_000,
    realEstateAssets: 3_000,
    otherAssets: 2_000,
  });
  assert.equal(result.salaryIncomeMan, 0);
  assert.ok(Math.abs(result.marketCapMan - (result.assetIncomeMan + 10_000)) < 1e-6);
});
