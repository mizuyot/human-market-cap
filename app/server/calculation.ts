import {
  CALCULATION_BEHAVIOR,
  INFLATION_RATE,
  TRANSITION_INCOME_GROWTH,
  careerSurvival,
  clipTransitionIncomeRate,
  commonTransitionIncome,
  financialLiteracyAdjustment,
  occupationAllowsTransitionIncome,
  projectionYearCount,
  recoverTowardOccupationFloor,
} from "../calculation-policy.ts";
import {
  type AnnualProjection,
  type CalculationResult,
  type ScoredCalculatorInputs,
  OCCUPATION_BASE_INCOME,
  getAppearance,
  getEducation,
  getOccupation,
  nwSalaryAdjustment,
  nwTransitionAdjustment,
  occupationIncomeFloor,
  wageCurveRate,
} from "../model.ts";

export function calculateMarketCap(input: ScoredCalculatorInputs): CalculationResult {
  const education = getEducation(input.education);
  const appearance = getAppearance(input.appearance);
  const job = getOccupation(input.occupation);
  const yearsRemaining = projectionYearCount(input.age, job.retirement);
  const financialAdjustment = financialLiteracyAdjustment(input.correctAnswers);
  const salaryNw = nwSalaryAdjustment(education.nw);
  const transitionNw = nwTransitionAdjustment(education.nw);
  const transitionIncomeRate = clipTransitionIncomeRate(job.transitionIncomeRate + transitionNw);
  const allowsTransition = occupationAllowsTransitionIncome(job, OCCUPATION_BASE_INCOME[job.key] ?? 0);
  const transitionBaseIncome = allowsTransition
    ? Math.max(
      Math.max(0, input.annualIncome) * transitionIncomeRate,
      commonTransitionIncome(input.age),
    )
    : 0;
  const initialOccupationIncomeFloor = occupationIncomeFloor(job, input.age);
  const appearanceSalaryAdjustment = appearance.salaryBase * job.appearanceMultiplier;
  const appearanceReturnAdjustment = appearance.returnAdjustment;
  const effectiveReturn = job.baseReturn + financialAdjustment + appearanceReturnAdjustment;
  const initialAssets = Math.max(0, input.financialAssets) + Math.max(0, input.realEstateAssets) + Math.max(0, input.otherAssets);
  let balance = initialAssets;
  let rawSalary = Math.max(0, input.annualIncome);
  let salaryTotal = 0;
  let assetTotal = 0;
  let reinvested = 0;
  let gains = 0;
  const projections: AnnualProjection[] = [];
  const retiredAtStart = input.age >= job.retirement;

  for (let year = 0; year < yearsRemaining; year += 1) {
    const age = input.age + year;
    const pastRetirement = age >= job.retirement;
    const survival = pastRetirement || retiredAtStart ? 0 : careerSurvival(job, age, year);
    const transitionSalary = allowsTransition
      ? transitionBaseIncome * Math.pow(1 + TRANSITION_INCOME_GROWTH, year)
      : 0;
    const salary = pastRetirement
      ? 0
      : rawSalary * survival + transitionSalary * (1 - survival);
    const careerFactor = rawSalary > 0 ? salary / rawSalary : survival;
    salaryTotal += salary;
    const add = salary * Math.min(1, Math.max(0, input.reinvestmentRate));
    reinvested += add;
    balance += add;
    const gain = balance * effectiveReturn;
    gains += gain;
    assetTotal += gain;
    balance += gain;
    const specialGrowth = year < (job.specialGrowthYears ?? 0) ? (job.specialGrowthRate ?? 0) : 0;
    const curveRate = pastRetirement ? 0 : wageCurveRate(job, input.age, year) + specialGrowth;
    projections.push({ age, rawSalary, salary, survival, careerFactor, curveRate, initialAssets, reinvested, gains, balance });

    if (!pastRetirement) {
      const projectedSalary = Math.max(0, rawSalary * (1 + curveRate + INFLATION_RATE + salaryNw + appearanceSalaryAdjustment));
      rawSalary = recoverTowardOccupationFloor(
        rawSalary,
        projectedSalary,
        occupationIncomeFloor(job, age + 1),
      );
    }
  }

  const salaryIncomeMan = salaryTotal * education.multiplier;
  const principalMan = CALCULATION_BEHAVIOR.includeInitialAssetsInMarketCap ? initialAssets : 0;
  return {
    marketCapMan: salaryIncomeMan + assetTotal + principalMan,
    salaryIncomeMan,
    assetIncomeMan: assetTotal,
    effectiveReturn,
    financialAdjustment,
    nwSalaryAdjustment: salaryNw,
    nwTransitionAdjustment: transitionNw,
    transitionIncomeRate,
    transitionBaseIncome,
    occupationIncomeFloor: initialOccupationIncomeFloor,
    appearanceSalaryAdjustment,
    appearanceReturnAdjustment,
    yearsRemaining,
    education,
    appearance,
    occupation: job,
    projections,
  };
}
