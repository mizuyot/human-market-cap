import {
  type AnnualProjection,
  type CalculationResult,
  type ScoredCalculatorInputs,
  getAppearance,
  getEducation,
  getOccupation,
  nwSalaryAdjustment,
  nwTransitionAdjustment,
  wageCurveRate,
} from "../model";

const financialLiteracyAdjustment = (correct: number) =>
  (Math.min(5, Math.max(0, correct)) / 5 - .5) * .1;

export function calculateMarketCap(input: ScoredCalculatorInputs): CalculationResult {
  const education = getEducation(input.education);
  const appearance = getAppearance(input.appearance);
  const job = getOccupation(input.occupation);
  const yearsRemaining = Math.max(0, job.retirement - input.age);
  const financialAdjustment = financialLiteracyAdjustment(input.correctAnswers);
  const salaryNw = nwSalaryAdjustment(education.nw);
  const transitionNw = nwTransitionAdjustment(education.nw);
  const transitionIncomeRate = Math.min(.9, Math.max(.2, job.transitionIncomeRate + transitionNw));
  const appearanceSalaryAdjustment = appearance.salaryBase * job.appearanceMultiplier;
  const appearanceReturnAdjustment = appearance.returnAdjustment;
  const effectiveReturn = job.baseReturn + financialAdjustment + appearanceReturnAdjustment;
  const initialAssets = Math.max(0, input.financialAssets) + Math.max(0, input.realEstateAssets) + Math.max(0, input.otherAssets);
  let balance = initialAssets;
  let rawSalary = Math.max(0, input.annualIncome, job.incomeFloor ?? 0);
  let salaryTotal = 0;
  let assetTotal = 0;
  let reinvested = 0;
  let gains = 0;
  const projections: AnnualProjection[] = [];

  for (let year = 0; year < yearsRemaining; year += 1) {
    const age = input.age + year;
    const survival = age >= job.primaryEnd ? 0 : Math.pow(1 - job.careerRisk, year);
    const careerFactor = survival + (1 - survival) * transitionIncomeRate;
    const salary = rawSalary * careerFactor;
    salaryTotal += salary;
    const add = salary * Math.min(1, Math.max(0, input.reinvestmentRate));
    reinvested += add;
    balance += add;
    const gain = balance * effectiveReturn;
    gains += gain;
    assetTotal += gain;
    balance += gain;
    const specialGrowth = year < (job.specialGrowthYears ?? 0) ? (job.specialGrowthRate ?? 0) : 0;
    const curveRate = wageCurveRate(job, input.age, year) + specialGrowth;
    projections.push({ age, rawSalary, salary, survival, careerFactor, curveRate, initialAssets, reinvested, gains, balance });
    rawSalary = Math.max(0, rawSalary * (1 + curveRate + .02 + salaryNw + appearanceSalaryAdjustment));
  }

  const salaryIncomeMan = salaryTotal * education.multiplier;
  return {
    marketCapMan: salaryIncomeMan + assetTotal,
    salaryIncomeMan,
    assetIncomeMan: assetTotal,
    effectiveReturn,
    financialAdjustment,
    nwSalaryAdjustment: salaryNw,
    nwTransitionAdjustment: transitionNw,
    transitionIncomeRate,
    appearanceSalaryAdjustment,
    appearanceReturnAdjustment,
    yearsRemaining,
    education,
    appearance,
    occupation: job,
    projections,
  };
}
