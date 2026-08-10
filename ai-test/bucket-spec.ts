/**
 * AIコメント用バケット正式定義とマッピング（サイト未組み込み）。
 * 計算ロジック本体は変更しない。参照のみ。
 */

import {
  OCCUPATIONS,
  OCCUPATION_BASE_INCOME,
  type OccupationKey,
} from "../app/model.ts";

/** G1〜G8 のラベル */
export const OCCUPATION_GROUP_LABELS = {
  G1: "安定型",
  G2: "高収入エリート",
  G3: "専門職",
  G4: "テック知識",
  G5: "独立経営",
  G6: "短期集中（芸能・夜職）",
  G7: "ギャンブルプロ",
  G8: "非就労・低安定",
} as const;

export type OccupationGroupId = keyof typeof OCCUPATION_GROUP_LABELS;

/**
 * 60職業キー → G1〜G8。
 * 迷った割当は行末コメントで理由を残す。
 */
export const OCCUPATION_GROUPS: Record<OccupationKey, OccupationGroupId> = {
  // —— G1 安定型（会社員・公共・金融安定・見た目依存の弱い定型就労）——
  bankFinance: "G1",
  listedGeneral: "G1",
  sme: "G1",
  skilled: "G1",
  service: "G1",
  public: "G1",
  teacher: "G1",
  childcare: "G1",
  bureaucrat: "G1", // 公務員カーブ寄り。エリート枠(G2)より組織安定を優先
  cabinCrew: "G1", // 芸能・夜職ではないがピーク早め。カテゴリemployeeのためG1

  // —— G2 高収入エリート ——
  fund: "G2",
  investmentBank: "G2",
  consultant: "G2",
  foreignTech: "G2", // GAFA/RSU込み。テック知識(G4)より報酬エリート性を優先
  listedManager: "G2", // 上場管理職・高度専門。一般社員(G1)と分離

  // —— G3 専門職（資格・専門ライセンス／長期専門キャリア）——
  doctor: "G3",
  dentist: "G3",
  lawyer: "G3",
  accountant: "G3",
  nurse: "G3",
  medicalSpecialist: "G3",
  researcher: "G3", // 知識職だがアカデミア専門職としてG3
  pilot: "G3", // 高スキル専門・employeeだが専門職性が強い
  boardGamePro: "G3", // エンタメ枠だが長期専門職（棋士・雀士）。G6の短期集中から除外

  // —— G4 テック知識 ——
  software: "G4",
  aiEngineer: "G4",
  productData: "G4",
  creative: "G4",

  // —— G5 独立経営 ——
  founder: "G5",
  angelInvestor: "G5",
  businessOwner: "G5",
  freelancer: "G5",
  reseller: "G5",
  farmerFisher: "G5",
  monk: "G5",
  politician: "G5", // 独立カテゴリ。当選リスクは大きいが「経営・独立」軸
  beautician: "G5", // 独立後モデルが主。安定会社員(G1)より自営寄り
  clubOwner: "G5", // 夜職産業だが「経営」。短期タレント(G6)より事業主

  // —— G6 短期集中（芸能・夜職全般）——
  entertainment: "G6",
  influencer: "G6",
  athlete: "G6",
  proGamer: "G6",
  comedian: "G6",
  voiceActor: "G6",
  boatCycleRacer: "G6",
  sumo: "G6",
  traditionalActor: "G6",
  host: "G6",
  hostess: "G6",
  sexWorker: "G6",
  nightlifeFreelance: "G6",
  mangaArtist: "G6", // ヒット依存・収入変動が芸能型のため G4→G6

  // —— G7 ギャンブルプロ ——
  pokerLive: "G7",
  pokerOnline: "G7",
  slotProfessional: "G7",
  professionalGambler: "G7",
  fullTimeTrader: "G7", // financeカテゴリだがgamblingカーブ・EXTREME。専業博打性でG7

  // —— G8 非就労・低安定 ——
  homemaker: "G8",
  unemployed: "G8",
  nonRegular: "G8", // employeeだが雇用不安定。G1から分離
};

export type AgeBandId = "A1" | "A2" | "A3" | "A4";
export type IncomeRelId = "low" | "mid" | "high";
export type AssetBehaviorId = "A1" | "A2" | "A3" | "A4" | "A5";
export type QuizBandId = "low" | "mid" | "high";
/** G8のみ。バケットIDには含めない */
export type G8SubType = "homemaker" | "nonRegular" | "unemployed";

export interface BucketInput {
  age: number;
  annualIncome: number;
  occupation: string;
  financialAssets: number;
  realEstateAssets: number;
  otherAssets: number;
  /** 0〜0.8 の小数（UIの%を割った値） */
  reinvestmentRate: number;
  /** クイズ正答数 0〜5 */
  correctAnswers: number;
}

export interface BucketAxes {
  group: OccupationGroupId;
  ageBand: AgeBandId;
  incomeRel: IncomeRelId;
  assetBehavior: AssetBehaviorId;
  quizBand: QuizBandId;
  /** G8のときのみ。それ以外は null */
  subType: G8SubType | null;
}

const AGE_BANDS_NORMAL: AgeBandId[] = ["A1", "A2", "A3", "A4"];
const AGE_BANDS_G6: AgeBandId[] = ["A1", "A2", "A3"];
const INCOME_RELS: IncomeRelId[] = ["low", "mid", "high"];
const ASSET_BEHAVIORS: AssetBehaviorId[] = ["A1", "A2", "A3", "A4", "A5"];
const QUIZ_BANDS: QuizBandId[] = ["low", "mid", "high"];
const GROUPS = Object.keys(OCCUPATION_GROUP_LABELS) as OccupationGroupId[];

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function occupationGroup(occupation: string): OccupationGroupId {
  if (occupation in OCCUPATION_GROUPS) {
    return OCCUPATION_GROUPS[occupation as OccupationKey];
  }
  // 未定義キーでも例外にせず安定型へ（全入力域で有効IDを返す）
  return "G1";
}

function primaryEndFor(occupation: string): number {
  const job = OCCUPATIONS.find((o) => o.key === occupation);
  return job?.primaryEnd ?? 65;
}

/**
 * 年齢帯。
 * 通常: A1=18-27 / A2=28-37 / A3=38-49 / A4=50+
 * G6: primaryEndまでの残り年数 — A1=>10年超 / A2=3-10年 / A3=3年未満・経過後
 */
export function resolveAgeBand(
  group: OccupationGroupId,
  age: number,
  occupation: string,
): AgeBandId {
  const a = Math.min(80, Math.max(18, Math.floor(finiteOr(age, 30))));
  if (group === "G6") {
    const remaining = primaryEndFor(occupation) - a;
    if (remaining > 10) return "A1";
    if (remaining >= 3) return "A2"; // 3〜10年
    return "A3"; // 3年未満または経過後
  }
  if (a <= 27) return "A1";
  if (a <= 37) return "A2";
  if (a <= 49) return "A3";
  return "A4";
}

/** 年収相対: 基準年収比、または基準0のとき絶対額 */
export function resolveIncomeRel(
  occupation: string,
  annualIncome: number,
): IncomeRelId {
  const income = Math.max(0, finiteOr(annualIncome, 0));
  const base = OCCUPATION_BASE_INCOME[occupation] ?? 0;
  if (base <= 0) {
    if (income < 200) return "low";
    if (income > 500) return "high";
    return "mid";
  }
  const ratio = income / base;
  if (ratio < 0.8) return "low";
  if (ratio > 1.5) return "high";
  return "mid";
}

/** 資産行動 A1〜A5 */
export function resolveAssetBehavior(
  financialAssets: number,
  realEstateAssets: number,
  otherAssets: number,
  reinvestmentRate: number,
): AssetBehaviorId {
  const assets =
    Math.max(0, finiteOr(financialAssets, 0)) +
    Math.max(0, finiteOr(realEstateAssets, 0)) +
    Math.max(0, finiteOr(otherAssets, 0));
  const rate = Math.min(0.8, Math.max(0, finiteOr(reinvestmentRate, 0)));

  if (assets >= 3000) return "A5";
  if (assets < 100) {
    return rate >= 0.2 ? "A2" : "A1";
  }
  // 100万以上〜3000万未満
  return rate >= 0.1 ? "A4" : "A3";
}

export function resolveQuizBand(correctAnswers: number): QuizBandId {
  const score = Math.min(5, Math.max(0, Math.round(finiteOr(correctAnswers, 0))));
  if (score <= 1) return "low";
  if (score <= 3) return "mid";
  return "high";
}

/** G8の属性文分岐用。バケットIDには影響しない */
export function resolveG8SubType(occupation: string): G8SubType | null {
  if (occupation === "homemaker") return "homemaker";
  if (occupation === "nonRegular") return "nonRegular";
  if (occupation === "unemployed") return "unemployed";
  return null;
}

export function resolveBucketAxes(input: BucketInput): BucketAxes {
  const group = occupationGroup(input.occupation);
  return {
    group,
    ageBand: resolveAgeBand(group, input.age, input.occupation),
    incomeRel: resolveIncomeRel(input.occupation, input.annualIncome),
    assetBehavior: resolveAssetBehavior(
      input.financialAssets,
      input.realEstateAssets,
      input.otherAssets,
      input.reinvestmentRate,
    ),
    quizBand: resolveQuizBand(input.correctAnswers),
    subType: group === "G8" ? resolveG8SubType(input.occupation) : null,
  };
}

/**
 * バケットID例: `G1-A2-mid-A3-low`
 * = グループ-年齢帯-年収相対-資産行動-クイズ帯
 */
export function toBucketId(input: BucketInput): string {
  const a = resolveBucketAxes(input);
  return `${a.group}-${a.ageBand}-${a.incomeRel}-${a.assetBehavior}-${a.quizBand}`;
}

/** 理論上あり得る全バケットID（G6は年齢3区分） */
export function listAllBucketIds(): string[] {
  const ids: string[] = [];
  for (const group of GROUPS) {
    const ages = group === "G6" ? AGE_BANDS_G6 : AGE_BANDS_NORMAL;
    for (const ageBand of ages) {
      for (const incomeRel of INCOME_RELS) {
        for (const assetBehavior of ASSET_BEHAVIORS) {
          for (const quizBand of QUIZ_BANDS) {
            ids.push(`${group}-${ageBand}-${incomeRel}-${assetBehavior}-${quizBand}`);
          }
        }
      }
    }
  }
  return ids;
}

export function bucketCountSummary(): {
  theoreticalIfAllFourAgeBands: number;
  actualWithG6Special: number;
  perGroup: Record<OccupationGroupId, number>;
} {
  const perCombo = INCOME_RELS.length * ASSET_BEHAVIORS.length * QUIZ_BANDS.length;
  const theoreticalIfAllFourAgeBands = GROUPS.length * 4 * perCombo;
  const perGroup = {} as Record<OccupationGroupId, number>;
  let actual = 0;
  for (const group of GROUPS) {
    const ageN = group === "G6" ? 3 : 4;
    const n = ageN * perCombo;
    perGroup[group] = n;
    actual += n;
  }
  return { theoreticalIfAllFourAgeBands, actualWithG6Special: actual, perGroup };
}

/** レビュー用: 職業キー → グループの全行 */
export function listOccupationGroupAssignments(): Array<{
  key: string;
  label: string;
  group: OccupationGroupId;
  groupLabel: string;
}> {
  return OCCUPATIONS.map((job) => {
    const group = occupationGroup(job.key);
    return {
      key: job.key,
      label: job.label,
      group,
      groupLabel: OCCUPATION_GROUP_LABELS[group],
    };
  });
}

/** 全60キーが OCCUPATION_GROUPS に存在するか */
export function assertAllOccupationsGrouped(): {
  ok: boolean;
  missing: string[];
  extra: string[];
} {
  const keys = new Set(OCCUPATIONS.map((o) => o.key));
  const grouped = new Set(Object.keys(OCCUPATION_GROUPS));
  const missing = [...keys].filter((k) => !grouped.has(k));
  const extra = [...grouped].filter((k) => !keys.has(k));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}
