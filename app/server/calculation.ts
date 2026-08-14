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
  type NextMove,
  type OccupationParam,
  type ScenarioId,
  type ScenarioQuote,
  type ScoredCalculatorInputs,
  type ValueDriver,
  OCCUPATION_BASE_INCOME,
  getAppearance,
  getEducation,
  getOccupation,
  getTier,
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
): Omit<CalculationResult, "scenarios" | "valueDrivers" | "nextMoves" | "modelVersion" | "careerOptionMan"> & {
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

/** 目安額を優しめに丸める（細かい差で不安にさせない） */
function softRoundUpliftMan(delta: number): number {
  const n = Math.max(0, Math.round(delta));
  if (n < 80) return 0;
  if (n < 500) return Math.round(n / 50) * 50;
  if (n < 3000) return Math.round(n / 100) * 100;
  if (n < 10000) return Math.round(n / 500) * 500;
  return Math.round(n / 1000) * 1000;
}

function baseMarketCapMan(input: ScoredCalculatorInputs): number {
  const job = getOccupation(input.occupation);
  return runProjection(input, withTunedJob(job, BASE_TUNING), BASE_TUNING).marketCapMan;
}

function buildNextMoves(
  input: ScoredCalculatorInputs,
  currentMan: number,
  upsideMan: number,
  occupationFloor: number,
): NextMove[] {
  const tier = getTier(currentMan);
  if (tier === "S" || tier === "A") return [];

  const candidates: NextMove[] = [];
  const pushIfUseful = (
    id: NextMove["id"],
    title: string,
    reason: string,
    focus: NextMove["focus"],
    nextMan: number,
  ) => {
    const upliftMan = softRoundUpliftMan(nextMan - currentMan);
    if (upliftMan <= 0) return;
    candidates.push({ id, title, reason, upliftMan, focus });
  };

  if (input.correctAnswers < 5) {
    const targetQuiz = Math.min(5, Math.max(input.correctAnswers + 2, 4));
    if (targetQuiz > input.correctAnswers) {
      pushIfUseful(
        "quiz",
        "金融判断をもう少し伸ばす",
        `いま ${input.correctAnswers}/5。${targetQuiz}/5 くらいまで伸びると、運用の寄与がやさしく効きやすくなります。`,
        "quiz",
        baseMarketCapMan({ ...input, correctAnswers: targetQuiz }),
      );
    }
  }

  if (input.reinvestmentRate < 0.25) {
    const fromPct = Math.round(input.reinvestmentRate * 100);
    const targetRate = Math.min(0.35, Math.max(0.25, input.reinvestmentRate + 0.15));
    const toPct = Math.round(targetRate * 100);
    pushIfUseful(
      "reinvestment",
      "毎年の積み立てを少し増やす",
      `再投資 ${fromPct}% → ${toPct}% くらい。無理のない範囲でも、後半ほど複利が味方になります。`,
      "reinvestment",
      baseMarketCapMan({ ...input, reinvestmentRate: targetRate }),
    );
  }

  const totalAssets = Math.max(0, input.financialAssets)
    + Math.max(0, input.realEstateAssets)
    + Math.max(0, input.otherAssets);
  if (totalAssets < 200) {
    const seedAdd = totalAssets < 50 ? 200 : 300;
    pushIfUseful(
      "seed-assets",
      "最初の種銭を少し用意する",
      `金融資産がまだ少ない局面です。種銭が加わると、資産所得がゆっくりエンジンになります。`,
      "assets",
      baseMarketCapMan({
        ...input,
        financialAssets: Math.max(0, input.financialAssets) + seedAdd,
      }),
    );
  }

  if (occupationFloor > 0 && input.annualIncome < occupationFloor * 0.72) {
    const targetIncome = Math.round(
      input.annualIncome + (occupationFloor - input.annualIncome) * 0.45,
    );
    if (targetIncome > input.annualIncome + 30) {
      pushIfUseful(
        "income-catchup",
        "本業のキャッチアップが進むと",
        `いまの年収から、職業ポテンシャルに少し近づくイメージです。急がなくて大丈夫です。`,
        "income",
        baseMarketCapMan({ ...input, annualIncome: targetIncome }),
      );
    }
  }

  const upsideLift = softRoundUpliftMan(upsideMan - currentMan);
  if (upsideLift > 0) {
    candidates.push({
      id: "upside-path",
      title: "成長や副収入がうまくいった場合",
      reason: "上振れシナリオの目安です。いまの延長だけでなく、「うまくいったとき」も隣に置いてあります。",
      upliftMan: upsideLift,
      focus: "scenario",
    });
  }

  return candidates
    .sort((a, b) => b.upliftMan - a.upliftMan)
    .slice(0, 3);
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
    nextMoves: buildNextMoves(input, base.marketCapMan, upside.marketCapMan, base.occupationIncomeFloor),
    modelVersion: MODEL_VERSION,
  };
}
