import {
  CALCULATION_BEHAVIOR,
  INFLATION_RATE,
  SCENARIO_FACTORS,
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
  type OccupationParam,
  type ScenarioId,
  type ScenarioQuote,
  type ScoredCalculatorInputs,
  type ValueDriver,
  OCCUPATION_BASE_INCOME,
  getAppearance,
  getEducation,
  getOccupation,
  nwSalaryAdjustment,
  nwTransitionAdjustment,
  occupationIncomeFloor,
  wageCurveRate,
} from "../model.ts";
import { MODEL_VERSION, careerOptionRate } from "../occupation-v20.ts";

type ScenarioTuning = {
  careerRiskMultiplier: number;
  returnBoost: number;
  optionMultiplier: number;
  salaryGrowthBoost: number;
};

const BASE_TUNING: ScenarioTuning = {
  careerRiskMultiplier: 1,
  returnBoost: 0,
  optionMultiplier: 1,
  salaryGrowthBoost: 0,
};

function withTunedJob(job: OccupationParam, tuning: ScenarioTuning): OccupationParam {
  return {
    ...job,
    careerRisk: Math.min(0.35, Math.max(0.001, job.careerRisk * tuning.careerRiskMultiplier)),
    baseReturn: Math.max(0.005, job.baseReturn + tuning.returnBoost),
  };
}

function runProjection(
  input: ScoredCalculatorInputs,
  job: OccupationParam,
  tuning: ScenarioTuning,
): Omit<CalculationResult, "scenarios" | "valueDrivers" | "modelVersion" | "careerOptionMan"> & {
  careerOptionMan: number;
  initialAssetsMan: number;
} {
  const education = getEducation(input.education);
  const appearance = getAppearance(input.appearance);
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
    const survival = pastRetirement || retiredAtStart
      ? 0
      : careerSurvival(job, age, year);
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
    const curveRate = pastRetirement
      ? 0
      : wageCurveRate(job, input.age, year) + specialGrowth + tuning.salaryGrowthBoost;
    projections.push({ age, rawSalary, salary, survival, careerFactor, curveRate, initialAssets, reinvested, gains, balance });

    if (!pastRetirement) {
      const projectedSalary = Math.max(
        0,
        rawSalary * (1 + curveRate + INFLATION_RATE + salaryNw + appearanceSalaryAdjustment),
      );
      rawSalary = recoverTowardOccupationFloor(
        rawSalary,
        projectedSalary,
        occupationIncomeFloor(job, age + 1),
      );
    }
  }

  const salaryIncomeMan = salaryTotal * education.multiplier;
  const optionRate = careerOptionRate(job.category) * tuning.optionMultiplier;
  const careerOptionMan = salaryIncomeMan * optionRate;
  const principalMan = CALCULATION_BEHAVIOR.includeInitialAssetsInMarketCap ? initialAssets : 0;

  return {
    marketCapMan: salaryIncomeMan + careerOptionMan + assetTotal + principalMan,
    salaryIncomeMan,
    careerOptionMan,
    assetIncomeMan: assetTotal,
    initialAssetsMan: principalMan,
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

function toScenarioQuote(
  id: ScenarioId,
  label: string,
  run: ReturnType<typeof runProjection>,
): ScenarioQuote {
  return {
    id,
    label,
    marketCapMan: run.marketCapMan,
    salaryIncomeMan: run.salaryIncomeMan,
    careerOptionMan: run.careerOptionMan,
    assetIncomeMan: run.assetIncomeMan,
    initialAssetsMan: run.initialAssetsMan,
  };
}

function buildValueDrivers(
  run: ReturnType<typeof runProjection>,
  input: ScoredCalculatorInputs,
): ValueDriver[] {
  const drivers: ValueDriver[] = [
    {
      id: "core-income",
      label: "本業所得",
      direction: "up",
      amountMan: run.salaryIncomeMan,
    },
    {
      id: "career-option",
      label: "キャリアの選択肢",
      direction: "up",
      amountMan: run.careerOptionMan,
    },
    {
      id: "asset-compounding",
      label: "資産の複利",
      direction: "up",
      amountMan: run.assetIncomeMan,
    },
  ];
  if (run.occupation.careerRisk >= 0.04) {
    drivers.push({
      id: "career-risk",
      label: "キャリア変動リスク",
      direction: "down",
      amountMan: Math.round(run.salaryIncomeMan * run.occupation.careerRisk * 8),
    });
  }
  if (input.reinvestmentRate < 0.15 && run.initialAssetsMan > 0) {
    drivers.push({
      id: "reinvestment-gap",
      label: "再投資が少ない",
      direction: "down",
      amountMan: Math.round(run.assetIncomeMan * 0.25),
    });
  }
  return drivers
    .filter((d) => d.amountMan > 0)
    .sort((a, b) => b.amountMan - a.amountMan)
    .slice(0, 4);
}

export function calculateMarketCap(input: ScoredCalculatorInputs): CalculationResult {
  const baseJob = getOccupation(input.occupation);
  const base = runProjection(input, withTunedJob(baseJob, BASE_TUNING), BASE_TUNING);
  const upside = runProjection(
    input,
    withTunedJob(baseJob, SCENARIO_FACTORS.upside),
    SCENARIO_FACTORS.upside,
  );
  const resilience = runProjection(
    input,
    withTunedJob(baseJob, SCENARIO_FACTORS.resilience),
    SCENARIO_FACTORS.resilience,
  );

  const scenarios: ScenarioQuote[] = [
    toScenarioQuote("base", "標準", base),
    toScenarioQuote("upside", "上振れ", upside),
    toScenarioQuote("resilience", "守り", resilience),
  ];

  return {
    marketCapMan: base.marketCapMan,
    salaryIncomeMan: base.salaryIncomeMan,
    careerOptionMan: base.careerOptionMan,
    assetIncomeMan: base.assetIncomeMan,
    effectiveReturn: base.effectiveReturn,
    financialAdjustment: base.financialAdjustment,
    nwSalaryAdjustment: base.nwSalaryAdjustment,
    nwTransitionAdjustment: base.nwTransitionAdjustment,
    transitionIncomeRate: base.transitionIncomeRate,
    transitionBaseIncome: base.transitionBaseIncome,
    occupationIncomeFloor: base.occupationIncomeFloor,
    appearanceSalaryAdjustment: base.appearanceSalaryAdjustment,
    appearanceReturnAdjustment: base.appearanceReturnAdjustment,
    yearsRemaining: base.yearsRemaining,
    education: base.education,
    appearance: base.appearance,
    occupation: base.occupation,
    projections: base.projections,
    scenarios,
    valueDrivers: buildValueDrivers(base, input),
    modelVersion: MODEL_VERSION,
  };
}
