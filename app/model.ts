export interface EducationParam {
  key: string;
  label: string;
  multiplier: number;
  nw: number;
}

export interface AppearanceParam {
  key: string;
  label: string;
  salaryBase: number;
}

export interface OccupationCategory {
  key: string;
  label: string;
}

export interface OccupationParam {
  key: string;
  category: string;
  label: string;
  retirement: number;
  primaryEnd: number;
  peak: number;
  baseReturn: number;
  appearanceMultiplier: number;
  careerRisk: number;
  transitionIncomeRate: number;
  riskLabel: string;
  rampUp: [number, number, number, number];
  rampDown: [number, number];
}

export const EDUCATIONS = [
  { key: "top100", label: "海外有名大学（Top100圏）", multiplier: 1.060, nw: 95 },
  { key: "tokyoKyotoDoctor", label: "東京大学・京都大学 博士", multiplier: 1.055, nw: 93 },
  { key: "tokyoKyotoMaster", label: "東京大学・京都大学 修士", multiplier: 1.050, nw: 90 },
  { key: "tokyoKyotoBachelor", label: "東京大学・京都大学 学部", multiplier: 1.045, nw: 88 },
  { key: "eliteDoctor", label: "一橋・東京科学・その他旧帝大 博士", multiplier: 1.040, nw: 85 },
  { key: "eliteMaster", label: "一橋・東京科学・その他旧帝大 修士", multiplier: 1.035, nw: 82 },
  { key: "eliteBachelor", label: "一橋・東京科学・その他旧帝大 学部", multiplier: 1.030, nw: 80 },
  { key: "sokeiGraduate", label: "早稲田・慶應 大学院", multiplier: 1.025, nw: 77 },
  { key: "sokeiBachelor", label: "早稲田・慶應 学部", multiplier: 1.020, nw: 74 },
  { key: "upperUniversity", label: "上位国公立・上智・東京理科", multiplier: 1.015, nw: 68 },
  { key: "march", label: "MARCH・関関同立", multiplier: 1.010, nw: 61 },
  { key: "university", label: "大学卒（その他）", multiplier: 1.000, nw: 50 },
  { key: "vocational", label: "専門学校・短大卒", multiplier: .995, nw: 42 },
  { key: "highSchool", label: "高卒", multiplier: .990, nw: 35 },
  { key: "middleSchool", label: "中卒", multiplier: .980, nw: 25 },
] as const satisfies readonly EducationParam[];

export const APPEARANCES = [
  { key: "top10", label: "上位10%", salaryBase: .006 },
  { key: "top35", label: "上位35%", salaryBase: .003 },
  { key: "middle", label: "中間", salaryBase: 0 },
  { key: "lower35", label: "下位35%", salaryBase: -.002 },
  { key: "lower10", label: "下位10%", salaryBase: -.004 },
] as const satisfies readonly AppearanceParam[];

export const OCCUPATION_CATEGORIES = [
  { key: "finance", label: "金融・コンサル" },
  { key: "professional", label: "医療・士業" },
  { key: "knowledge", label: "IT・研究・クリエイティブ" },
  { key: "employee", label: "会社員・公共・サービス" },
  { key: "independent", label: "経営・独立" },
  { key: "entertainment", label: "芸能・スポーツ" },
  { key: "nightlife", label: "夜職" },
  { key: "gambling", label: "ギャンブルプロ" },
] as const satisfies readonly OccupationCategory[];

const curve = {
  financeElite: [[.06, .04, .02, .005], [-.01, -.025]],
  financeStable: [[.04, .03, .015, .005], [-.008, -.02]],
  professional: [[.04, .03, .01, .003], [-.01, -.025]],
  tech: [[.05, .035, .015, .003], [-.015, -.03]],
  stable: [[.03, .02, .01, .003], [-.008, -.015]],
  service: [[.025, .015, .005, 0], [-.01, -.02]],
  public: [[.02, .015, .01, .003], [0, -.008]],
  independent: [[.04, .03, .01, .003], [-.01, -.025]],
  founder: [[.07, .04, .01, 0], [-.02, -.04]],
  entertainment: [[.08, .04, 0, -.04], [-.08, -.12]],
  influencer: [[.10, .05, -.02, -.06], [-.10, -.15]],
  athlete: [[.10, .05, 0, -.06], [-.12, -.18]],
  nightlife: [[.08, .04, 0, -.04], [-.08, -.12]],
  gambling: [[.06, .03, 0, -.02], [-.05, -.08]],
  slot: [[.04, .01, -.02, -.04], [-.08, -.12]],
} as const;

function occupation(
  key: string,
  category: string,
  label: string,
  retirement: number,
  primaryEnd: number,
  peak: number,
  baseReturn: number,
  appearanceMultiplier: number,
  careerRisk: number,
  transitionIncomeRate: number,
  riskLabel: string,
  wage: keyof typeof curve,
): OccupationParam {
  return {
    key, category, label, retirement, primaryEnd, peak, baseReturn,
    appearanceMultiplier, careerRisk, transitionIncomeRate, riskLabel,
    rampUp: [...curve[wage][0]], rampDown: [...curve[wage][1]],
  };
}

export const OCCUPATIONS = [
  occupation("fund", "finance", "ヘッジファンド・PE", 65, 60, 42, .040, .3, .030, .70, "HIGH", "financeElite"),
  occupation("investmentBank", "finance", "投資銀行・マーケット・トレーダー", 65, 60, 43, .038, .5, .025, .70, "HIGH", "financeElite"),
  occupation("bankFinance", "finance", "銀行・証券・保険", 65, 65, 52, .032, .5, .010, .75, "LOW", "financeStable"),
  occupation("consultant", "finance", "戦略・総合・ITコンサルタント", 67, 65, 47, .033, .9, .020, .70, "MID", "financeElite"),

  occupation("doctor", "professional", "医師", 70, 70, 55, .025, .3, .004, .80, "LOW", "professional"),
  occupation("dentist", "professional", "歯科医師", 70, 70, 50, .025, .5, .015, .70, "MID-LOW", "independent"),
  occupation("lawyer", "professional", "弁護士", 70, 70, 52, .028, .6, .015, .70, "MID-LOW", "professional"),
  occupation("accountant", "professional", "会計士・税理士", 70, 70, 55, .028, .4, .010, .75, "LOW", "professional"),
  occupation("medicalSpecialist", "professional", "薬剤師・看護師・医療専門職", 67, 65, 50, .023, .3, .008, .75, "LOW", "stable"),

  occupation("software", "knowledge", "ソフトウェア・AIエンジニア", 67, 65, 45, .032, .4, .015, .65, "MID-LOW", "tech"),
  occupation("productData", "knowledge", "プロダクト・データ・IT専門職", 67, 65, 48, .032, .7, .015, .70, "MID-LOW", "tech"),
  occupation("researcher", "knowledge", "研究者・大学教員", 70, 70, 55, .025, .2, .010, .70, "LOW", "professional"),
  occupation("creative", "knowledge", "デザイナー・編集・ライター", 67, 65, 42, .026, 1.0, .030, .55, "HIGH", "independent"),

  occupation("listedManager", "employee", "上場企業 管理職・高度専門職", 65, 65, 55, .030, .6, .008, .75, "LOW", "stable"),
  occupation("listedGeneral", "employee", "上場企業 一般社員", 65, 65, 55, .028, .5, .008, .75, "LOW", "stable"),
  occupation("sme", "employee", "中小企業 事務・営業職", 65, 65, 53, .025, .5, .012, .65, "MID-LOW", "stable"),
  occupation("skilled", "employee", "製造・建設・物流・技能職", 65, 65, 52, .024, .3, .015, .65, "MID-LOW", "stable"),
  occupation("service", "employee", "小売・飲食・宿泊・介護サービス", 65, 65, 48, .022, .8, .020, .60, "MID", "service"),
  occupation("public", "employee", "公務員", 65, 65, 60, .023, .2, .002, .80, "VERY LOW", "public"),
  occupation("teacher", "employee", "教員・教育職", 65, 65, 55, .023, .4, .006, .75, "LOW", "public"),

  occupation("founder", "independent", "スタートアップ起業家", 70, 70, 50, .030, 1.0, .045, .55, "VERY HIGH", "founder"),
  occupation("businessOwner", "independent", "安定事業の経営者・自営業", 70, 70, 55, .028, 1.0, .025, .65, "HIGH", "independent"),
  occupation("freelancer", "independent", "高スキルフリーランス", 70, 67, 50, .030, .8, .025, .60, "HIGH", "independent"),

  occupation("entertainment", "entertainment", "俳優・タレント・音楽家", 65, 55, 35, .025, 2.0, .070, .45, "EXTREME", "entertainment"),
  occupation("influencer", "entertainment", "インフルエンサー・配信者", 65, 50, 32, .028, 1.6, .080, .40, "EXTREME", "influencer"),
  occupation("athlete", "entertainment", "プロスポーツ選手", 65, 40, 29, .025, 1.0, .050, .55, "EXTREME", "athlete"),

  occupation("host", "nightlife", "ホスト", 65, 45, 30, .018, 2.0, .080, .45, "EXTREME", "nightlife"),
  occupation("hostess", "nightlife", "ホステス・キャバクラ", 65, 45, 28, .018, 2.0, .070, .45, "EXTREME", "nightlife"),
  occupation("clubOwner", "nightlife", "クラブママ・夜職経営", 70, 70, 52, .022, 1.2, .040, .55, "HIGH", "independent"),

  occupation("poker", "gambling", "プロポーカー", 65, 55, 38, .040, .1, .080, .40, "VERY HIGH", "gambling"),
  occupation("betting", "gambling", "競馬・スポーツベット", 65, 60, 45, .035, .1, .070, .40, "VERY HIGH", "gambling"),
  occupation("slot", "gambling", "スロットプロ", 65, 50, 32, .030, .1, .100, .35, "EXTREME", "slot"),
] as const;

export type EducationKey = typeof EDUCATIONS[number]["key"];
export type AppearanceKey = typeof APPEARANCES[number]["key"];
export type OccupationKey = typeof OCCUPATIONS[number]["key"];
export type OccupationCategoryKey = typeof OCCUPATION_CATEGORIES[number]["key"];

export interface CalculatorInputs {
  age: number;
  annualIncome: number;
  education: EducationKey;
  appearance: AppearanceKey;
  occupation: OccupationKey;
  financialAssets: number;
  realEstateAssets: number;
  reinvestmentRate: number;
  correctAnswers: number;
}

export interface AnnualProjection {
  age: number;
  rawSalary: number;
  salary: number;
  survival: number;
  careerFactor: number;
  curveRate: number;
  initialAssets: number;
  reinvested: number;
  gains: number;
  balance: number;
}

export interface CalculationResult {
  marketCapMan: number;
  salaryIncomeMan: number;
  assetIncomeMan: number;
  effectiveReturn: number;
  financialAdjustment: number;
  nwSalaryAdjustment: number;
  nwTransitionAdjustment: number;
  transitionIncomeRate: number;
  appearanceSalaryAdjustment: number;
  yearsRemaining: number;
  education: EducationParam;
  appearance: AppearanceParam;
  occupation: OccupationParam;
  projections: AnnualProjection[];
}

export function getEducation(key: EducationKey): EducationParam {
  return EDUCATIONS.find((item) => item.key === key) ?? EDUCATIONS[11];
}

export function getAppearance(key: AppearanceKey): AppearanceParam {
  return APPEARANCES.find((item) => item.key === key) ?? APPEARANCES[2];
}

export function getOccupation(key: OccupationKey): OccupationParam {
  return OCCUPATIONS.find((item) => item.key === key) ?? OCCUPATIONS[14];
}

export function getOccupationsByCategory(category: OccupationCategoryKey): OccupationParam[] {
  return OCCUPATIONS.filter((item) => item.category === category);
}

export const financialLiteracyAdjustment = (correct: number) =>
  (Math.min(5, Math.max(0, correct)) / 5 - .5) * .1;

export const nwSalaryAdjustment = (nw: number) => Math.min(.0045, Math.max(-.0025, (nw - 50) * .0001));
export const nwTransitionAdjustment = (nw: number) => Math.min(.045, Math.max(-.025, (nw - 50) * .001));

export function wageCurveRate(job: OccupationParam, startAge: number, elapsed: number): number {
  const age = startAge + elapsed;
  if (age >= job.primaryEnd) return -.005;
  if (age < job.peak) {
    const segment = Math.max(.25, Math.max(1, job.peak - startAge) / 4);
    return job.rampUp[Math.min(3, Math.floor(elapsed / segment))];
  }
  return job.rampDown[Math.min(1, Math.floor(Math.max(0, age - job.peak) / 5))];
}

export function miniWageCurve(job: OccupationParam): number[] {
  const start = Math.max(20, job.peak - 16);
  let value = 100;
  const points: number[] = [];
  for (let year = 0; year < 28; year += 2) {
    value *= Math.pow(1 + wageCurveRate(job, start, year) + .02, 2);
    points.push(Math.max(10, value));
  }
  return points;
}

export function calculateMarketCap(input: CalculatorInputs): CalculationResult {
  const education = getEducation(input.education);
  const appearance = getAppearance(input.appearance);
  const job = getOccupation(input.occupation);
  const yearsRemaining = Math.max(0, job.retirement - input.age);
  const financialAdjustment = financialLiteracyAdjustment(input.correctAnswers);
  const salaryNw = nwSalaryAdjustment(education.nw);
  const transitionNw = nwTransitionAdjustment(education.nw);
  const transitionIncomeRate = Math.min(.9, Math.max(.2, job.transitionIncomeRate + transitionNw));
  const appearanceSalaryAdjustment = appearance.salaryBase * job.appearanceMultiplier;
  const effectiveReturn = Math.min(.05, job.baseReturn + financialAdjustment);
  const initialAssets = Math.max(0, input.financialAssets) + Math.max(0, input.realEstateAssets);
  let balance = initialAssets;
  let rawSalary = Math.max(0, input.annualIncome);
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
    const curveRate = wageCurveRate(job, input.age, year);
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
    yearsRemaining,
    education,
    appearance,
    occupation: job,
    projections,
  };
}

export function getTier(value: number): "S" | "A" | "B" | "C" | "D" {
  return value >= 50000 ? "S" : value >= 20000 ? "A" : value >= 8000 ? "B" : value >= 2000 ? "C" : "D";
}

export function formatMan(value: number): string {
  const n = Math.round(Math.abs(value));
  const sign = value < 0 ? "−" : "";
  if (n >= 10000) {
    const oku = Math.floor(n / 10000);
    const man = n % 10000;
    return `${sign}${oku}億${man ? `${man.toLocaleString("ja-JP")}万` : ""}円`;
  }
  return `${sign}${n.toLocaleString("ja-JP")}万円`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}
