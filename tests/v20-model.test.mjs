import assert from "node:assert/strict";
import test from "node:test";
import { calculateMarketCap } from "../app/server/calculation.ts";
import { OCCUPATION_BASE_INCOME, getOccupation } from "../app/model.ts";
import { MODEL_VERSION, V20_POTENTIAL_INCOME } from "../app/occupation-v20.ts";

const sample = {
  age: 30,
  annualIncome: 500,
  education: "university",
  appearance: "middle",
  occupation: "listedGeneral",
  financialAssets: 300,
  realEstateAssets: 0,
  otherAssets: 0,
  reinvestmentRate: 0.2,
  correctAnswers: 3,
};

test("v20 potential income anchors replace v19 base incomes", () => {
  assert.equal(MODEL_VERSION, "v20");
  assert.equal(OCCUPATION_BASE_INCOME.aiEngineer, 850);
  assert.equal(OCCUPATION_BASE_INCOME.listedGeneral, 520);
  assert.equal(OCCUPATION_BASE_INCOME.doctor, 1200);
  assert.equal(Object.keys(V20_POTENTIAL_INCOME).length, 60);
});

test("v20 extends stable careers and keeps early primary ends for athletes", () => {
  const ai = getOccupation("aiEngineer");
  assert.equal(ai.retirement, 70);
  assert.ok(ai.primaryEnd >= 68);

  const athlete = getOccupation("athlete");
  assert.equal(athlete.primaryEnd, 45);
  assert.equal(athlete.retirement, 65);
});

test("valuation returns quote scenarios and career option", () => {
  const result = calculateMarketCap(sample);
  assert.equal(result.modelVersion, "v20");
  assert.ok(result.careerOptionMan > 0);
  assert.equal(result.scenarios.length, 3);
  const [base, upside, resilience] = result.scenarios;
  assert.equal(base.id, "base");
  assert.ok(upside.marketCapMan >= base.marketCapMan);
  assert.ok(resilience.marketCapMan <= base.marketCapMan);
  assert.ok(Math.abs(result.marketCapMan - base.marketCapMan) < 1e-6);
  assert.ok(
    Math.abs(
      result.marketCapMan
        - (result.salaryIncomeMan + result.careerOptionMan + result.assetIncomeMan
          + sample.financialAssets + sample.realEstateAssets + sample.otherAssets),
    ) < 1e-6,
  );
  assert.ok(result.valueDrivers.length >= 2);
});
