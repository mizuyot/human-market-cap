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
  returnAdjustment: number;
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
  specialGrowthYears?: number;
  specialGrowthRate?: number;
  specialNote?: string;
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
  { key: "top10", label: "上位10%", salaryBase: .006, returnAdjustment: -.010 },
  { key: "top35", label: "上位35%", salaryBase: .003, returnAdjustment: -.005 },
  { key: "middle", label: "中間", salaryBase: 0, returnAdjustment: 0 },
  { key: "lower35", label: "下位35%", salaryBase: -.002, returnAdjustment: .003 },
  { key: "lower10", label: "下位10%", salaryBase: -.004, returnAdjustment: .005 },
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
  { key: "lifestyle", label: "生活・無業" },
] as const satisfies readonly OccupationCategory[];

const curve = {
  hedgeFund: [[.36, .24, .12, .030], [-.100, -.180]],
  financeElite: [[.10, .065, .025, -.010], [-.040, -.070]],
  financeStable: [[.065, .040, .015, -.005], [-.030, -.055]],
  professional: [[.065, .045, .015, -.010], [-.035, -.060]],
  tech: [[.085, .055, .015, -.020], [-.050, -.085]],
  ai: [[.180, .120, .050, -.020], [-.080, -.150]],
  foreignTech: [[.140, .090, .030, -.010], [-.050, -.090]],
  stable: [[.045, .030, .010, -.005], [-.030, -.050]],
  service: [[.040, .025, .005, -.015], [-.040, -.065]],
  public: [[.030, .022, .012, 0], [-.015, -.035]],
  independent: [[.075, .050, .015, -.015], [-.050, -.080]],
  founder: [[.140, .080, .020, -.040], [-.080, -.140]],
  lottery: [[.300, .150, -.100, -.250], [-.300, -.450]],
  entertainment: [[.180, .100, -.030, -.120], [-.180, -.280]],
  influencer: [[.220, .120, -.080, -.160], [-.220, -.320]],
  athlete: [[.200, .100, -.050, -.150], [-.250, -.380]],
  nightlife: [[.180, .090, -.040, -.120], [-.180, -.280]],
  gambling: [[.120, .065, -.020, -.080], [-.120, -.200]],
  flat: [[0, 0, 0, 0], [0, 0]],
} as const;

type OccupationExtras = Partial<Pick<OccupationParam,
  "specialGrowthYears" | "specialGrowthRate" | "specialNote"
>>;

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
  extras: OccupationExtras = {},
): OccupationParam {
  return {
    key, category, label, retirement, primaryEnd, peak, baseReturn,
    appearanceMultiplier, careerRisk, transitionIncomeRate, riskLabel,
    rampUp: [...curve[wage][0]], rampDown: [...curve[wage][1]],
    ...extras,
  };
}

export const OCCUPATIONS = [
  occupation("fund", "finance", "ヘッジファンド・PE", 65, 60, 45, .040, .3, .030, .70, "HIGH", "hedgeFund", { specialNote: "報酬カーブ極端：成果報酬で急伸" }),
  occupation("investmentBank", "finance", "投資銀行・マーケット・トレーダー", 65, 60, 43, .038, .5, .025, .70, "HIGH", "financeElite"),
  occupation("bankFinance", "finance", "銀行・証券・保険", 65, 65, 52, .032, .5, .010, .75, "LOW", "financeStable"),
  occupation("consultant", "finance", "戦略・総合・ITコンサルタント", 67, 65, 47, .033, .9, .020, .70, "MID", "financeElite"),
  occupation("fullTimeTrader", "finance", "専業トレーダー・仮想通貨", 65, 55, 38, .050, .1, .100, .35, "EXTREME", "gambling", { specialNote: "高ボラティリティ：上振れも下振れも最大級" }),

  occupation("doctor", "professional", "医師", 70, 70, 55, .025, .3, .004, .80, "LOW", "professional"),
  occupation("dentist", "professional", "歯科医師", 70, 70, 50, .025, .5, .015, .70, "MID-LOW", "independent"),
  occupation("lawyer", "professional", "弁護士", 70, 70, 52, .028, .6, .015, .70, "MID-LOW", "professional"),
  occupation("accountant", "professional", "会計士・税理士", 70, 70, 55, .028, .4, .010, .75, "LOW", "professional"),
  occupation("nurse", "professional", "看護師", 67, 65, 50, .024, .4, .012, .75, "MID-LOW", "stable", { specialNote: "夜勤手当と高い職業可搬性を反映" }),
  occupation("medicalSpecialist", "professional", "薬剤師・医療専門職", 67, 65, 50, .023, .3, .008, .75, "LOW", "stable"),

  occupation("software", "knowledge", "ITエンジニア", 67, 65, 45, .032, .4, .015, .68, "MID-LOW", "tech"),
  occupation("aiEngineer", "knowledge", "AIエンジニア", 67, 65, 45, .042, .3, .018, .75, "MID", "ai", { specialGrowthYears: 5, specialGrowthRate: .30, specialNote: "今後5年間の成長率：全職業で最強" }),
  occupation("foreignTech", "knowledge", "外資IT（GAFA系・RSU込み）", 67, 65, 48, .045, .4, .018, .75, "MID", "foreignTech", { specialNote: "RSU込みの高成長・高利回りモデル" }),
  occupation("productData", "knowledge", "プロダクト・データ・IT専門職", 67, 65, 48, .032, .7, .015, .70, "MID-LOW", "tech"),
  occupation("researcher", "knowledge", "研究者・大学教員", 70, 70, 55, .025, .2, .010, .70, "LOW", "professional"),
  occupation("creative", "knowledge", "デザイナー・編集・ライター", 67, 65, 42, .026, 1.0, .030, .55, "HIGH", "independent"),
  occupation("mangaArtist", "knowledge", "漫画家・イラストレーター", 70, 60, 42, .028, 1.2, .060, .45, "VERY HIGH", "lottery", { specialNote: "印税・ヒット作による極端な上振れモデル" }),

  occupation("listedManager", "employee", "上場企業 管理職・高度専門職", 65, 65, 55, .030, .6, .008, .75, "LOW", "stable"),
  occupation("listedGeneral", "employee", "上場企業 一般社員", 65, 65, 55, .028, .5, .008, .75, "LOW", "stable"),
  occupation("sme", "employee", "中小企業 事務・営業職", 65, 65, 53, .025, .5, .012, .65, "MID-LOW", "stable"),
  occupation("nonRegular", "employee", "非正規雇用", 65, 65, 45, .018, .7, .045, .50, "HIGH", "service"),
  occupation("skilled", "employee", "製造・建設・物流・技能職", 65, 65, 52, .024, .3, .015, .65, "MID-LOW", "stable"),
  occupation("service", "employee", "小売・飲食・宿泊・介護サービス", 65, 65, 48, .022, .8, .020, .60, "MID", "service"),
  occupation("public", "employee", "公務員", 65, 65, 60, .023, .2, .002, .80, "VERY LOW", "public"),
  occupation("teacher", "employee", "教師", 65, 65, 55, .023, .4, .006, .75, "LOW", "public"),
  occupation("childcare", "employee", "保育士", 65, 65, 50, .020, .7, .015, .65, "MID-LOW", "service"),
  occupation("bureaucrat", "employee", "官僚（キャリア）", 70, 65, 58, .030, .2, .012, .80, "MID-LOW", "public", { specialNote: "薄給激務から後半に伸びる特殊カーブ" }),
  occupation("pilot", "employee", "パイロット", 67, 65, 55, .030, .4, .010, .80, "LOW", "professional"),
  occupation("cabinCrew", "employee", "客室乗務員（CA）", 65, 60, 45, .023, 1.6, .025, .60, "HIGH", "service"),
  occupation("beautician", "employee", "美容師", 70, 65, 48, .022, 2.0, .035, .55, "HIGH", "independent", { specialNote: "アシスタント期から独立後へ伸びるモデル" }),

  occupation("founder", "independent", "スタートアップ起業家", 70, 70, 50, .030, 1.0, .045, .55, "VERY HIGH", "founder"),
  occupation("angelInvestor", "independent", "エンジェル投資家・連続起業家", 75, 75, 55, .045, .5, .060, .55, "VERY HIGH", "founder", { specialNote: "※未上場資産は流動性が低く、希薄化リスクも大きいモデル" }),
  occupation("businessOwner", "independent", "安定事業の経営者・自営業", 70, 70, 55, .028, 1.0, .025, .65, "HIGH", "independent"),
  occupation("freelancer", "independent", "高スキルフリーランス", 70, 67, 50, .030, .8, .025, .60, "HIGH", "independent"),
  occupation("reseller", "independent", "転売ヤー・せどり", 70, 65, 42, .028, .3, .100, .45, "EXTREME", "gambling", { specialNote: "アカウントBAN・プラットフォーム規約変更による急落リスクを反映" }),
  occupation("farmerFisher", "independent", "農家・漁師", 75, 70, 55, .025, .3, .035, .60, "HIGH", "independent", { specialNote: "土地・船など事業資産を持つ一次産業モデル" }),
  occupation("monk", "independent", "僧侶・宗教家", 80, 80, 60, .024, .5, .015, .70, "MID-LOW", "stable"),
  occupation("politician", "independent", "政治家", 100, 100, 60, .030, 1.2, .150, .40, "EXTREME", "lottery", { specialNote: "引退年齢なし・落選リスク極大" }),

  occupation("entertainment", "entertainment", "俳優・タレント・音楽家", 65, 55, 35, .025, 2.0, .070, .45, "EXTREME", "entertainment"),
  occupation("influencer", "entertainment", "YouTuber・配信者・VTuber", 65, 50, 32, .028, 1.6, .080, .40, "EXTREME", "influencer", { specialNote: "この査定、ぜひ動画や配信のネタにしてね！" }),
  occupation("athlete", "entertainment", "プロスポーツ選手", 65, 40, 29, .025, 1.0, .050, .55, "EXTREME", "athlete"),
  occupation("proGamer", "entertainment", "プロゲーマー・eスポーツ", 60, 38, 26, .026, .5, .100, .35, "EXTREME", "athlete"),
  occupation("comedian", "entertainment", "お笑い芸人", 70, 60, 42, .020, 1.8, .100, .35, "EXTREME", "lottery", { specialNote: "売れるまで低収入、当たれば急騰の極端モデル" }),
  occupation("voiceActor", "entertainment", "声優", 70, 60, 40, .023, 2.0, .070, .45, "EXTREME", "entertainment"),
  occupation("boatCycleRacer", "entertainment", "競艇・競輪選手", 60, 45, 32, .030, .4, .060, .55, "VERY HIGH", "athlete", { specialNote: "知られざる高収入アスリート枠" }),
  occupation("boardGamePro", "entertainment", "プロ棋士・プロ雀士", 75, 70, 50, .030, .2, .045, .55, "VERY HIGH", "independent"),
  occupation("sumo", "entertainment", "力士", 65, 35, 27, .022, .5, .120, .35, "EXTREME", "athlete", { specialNote: "番付ピラミッドと早期引退を反映" }),
  occupation("traditionalActor", "entertainment", "歌舞伎役者・伝統芸能", 80, 75, 55, .028, 2.0, .030, .65, "HIGH", "entertainment", { specialNote: "世襲・家柄プレミアムを含む特殊モデル" }),

  occupation("host", "nightlife", "ホスト", 65, 45, 30, .018, 8.0, .080, .45, "EXTREME", "nightlife"),
  occupation("hostess", "nightlife", "ラウンジ嬢・ホステス・キャバクラ", 65, 45, 28, .018, 8.0, .070, .45, "EXTREME", "nightlife", { specialNote: "売上はシャンパンと太客の気分次第。夜の市場は寄り付きから値動き激しめ" }),
  occupation("sexWorker", "nightlife", "風俗", 65, 42, 27, .018, 10.0, .100, .40, "EXTREME", "nightlife"),
  occupation("nightlifeFreelance", "nightlife", "港区フリーランス", 65, 40, 26, .016, 9.0, .120, .35, "EXTREME", "nightlife"),
  occupation("clubOwner", "nightlife", "クラブママ・夜職経営", 70, 70, 52, .022, 4.0, .040, .55, "HIGH", "independent"),

  occupation("pokerLive", "gambling", "ポーカー専業（ライブ）", 65, 55, 38, .045, .2, .090, .40, "EXTREME", "gambling", { specialNote: "EVの見積もり違いと遠征費で、バンクロール崩壊の警告が点灯します" }),
  occupation("pokerOnline", "gambling", "ポーカー専業（オンライン）", 65, 55, 35, .047, .1, .110, .40, "EXTREME", "gambling", { specialNote: "レーキ・規約変更・アカウント停止を含むバンクロール変動モデル" }),
  occupation("slotProfessional", "gambling", "スロット専業", 60, 50, 35, .035, .1, .120, .35, "EXTREME", "gambling", { specialNote: "設定読みと期待値が外れると、バンクロールは静かに崩壊します" }),
  occupation("professionalGambler", "gambling", "プロギャンブラー（競馬・スポーツベット等）", 65, 55, 38, .037, .1, .085, .40, "EXTREME", "gambling"),

  occupation("homemaker", "lifestyle", "専業主婦・主夫", 75, 75, 55, .020, .4, .010, .65, "LOW", "stable", { specialNote: "本人の家事労働を市場価値へ換算。配偶者の収入・与信は含めません" }),
  occupation("unemployed", "lifestyle", "無職・ニート", 65, 65, 35, .010, 0, .100, .30, "EXTREME", "flat", { specialNote: "収入0円でも資産運用分は時価総額に反映" }),
] as const;

export type EducationKey = typeof EDUCATIONS[number]["key"];
export type AppearanceKey = typeof APPEARANCES[number]["key"];
export type OccupationKey = typeof OCCUPATIONS[number]["key"];
export type OccupationCategoryKey = typeof OCCUPATION_CATEGORIES[number]["key"];

export const OCCUPATION_BASE_INCOME: Record<string, number> = {
  fund: 1200, investmentBank: 1000, bankFinance: 450, consultant: 600, fullTimeTrader: 400,
  doctor: 900, dentist: 500, lawyer: 500, accountant: 450, nurse: 400, medicalSpecialist: 380,
  software: 450, aiEngineer: 600, foreignTech: 800, productData: 550, researcher: 400, creative: 300, mangaArtist: 240,
  listedManager: 700, listedGeneral: 400, sme: 300, nonRegular: 180, skilled: 320, service: 260, public: 350,
  teacher: 350, childcare: 260, bureaucrat: 450, pilot: 900, cabinCrew: 350, beautician: 240,
  founder: 300, angelInvestor: 500, businessOwner: 350, freelancer: 350, reseller: 300, farmerFisher: 300,
  monk: 250, politician: 600,
  entertainment: 240, influencer: 200, athlete: 400, proGamer: 200, comedian: 120, voiceActor: 180,
  boatCycleRacer: 600, boardGamePro: 300, sumo: 300, traditionalActor: 400,
  host: 300, hostess: 300, sexWorker: 350, nightlifeFreelance: 280, clubOwner: 500,
  pokerLive: 350, pokerOnline: 350, slotProfessional: 300, professionalGambler: 300,
  homemaker: 350, unemployed: 0,
};

export function occupationIncomeFloor(job: OccupationParam, age: number): number {
  const base = OCCUPATION_BASE_INCOME[job.key] ?? 0;
  if (job.key === "homemaker" || base === 0) return base;
  const distance = age - job.peak;
  const ageFactor = distance < 0
    ? Math.max(.65, 1 - Math.abs(distance) * .02)
    : Math.max(.55, 1 - distance * .025);
  return Math.round(base * ageFactor);
}

export interface CalculatorInputs {
  age: number;
  annualIncome: number;
  education: EducationKey;
  appearance: AppearanceKey;
  occupation: OccupationKey;
  financialAssets: number;
  realEstateAssets: number;
  otherAssets: number;
  reinvestmentRate: number;
}

export interface ScoredCalculatorInputs extends CalculatorInputs {
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
  transitionBaseIncome: number;
  occupationIncomeFloor: number;
  appearanceSalaryAdjustment: number;
  appearanceReturnAdjustment: number;
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
  return OCCUPATIONS.find((item) => item.key === key)
    ?? OCCUPATIONS.find((item) => item.key === "listedGeneral")
    ?? OCCUPATIONS[0];
}

export function getOccupationsByCategory(category: OccupationCategoryKey): OccupationParam[] {
  return OCCUPATIONS.filter((item) => item.category === category);
}

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
    const specialGrowth = year < (job.specialGrowthYears ?? 0) ? (job.specialGrowthRate ?? 0) : 0;
    value *= Math.pow(1 + wageCurveRate(job, start, year) + specialGrowth + .02, 2);
    points.push(Math.max(10, value));
  }
  return points;
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
