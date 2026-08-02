/**
 * 時価総額計算の調整つまみ。
 * 数値・判定ルールを変えるときは、まずここを見る。
 * Excel台帳の共通設定と揃えること。コードへは手動反映。
 */

import type { OccupationParam } from "./model.ts";

/** 毎年のインフレ加算（年収成長・転職後年収） */
export const INFLATION_RATE = 0.02;

/** 転職後年収の年次成長（インフレ相当） */
export const TRANSITION_INCOME_GROWTH = INFLATION_RATE;

/** 金融リテラシー: ((正答/満点) - 0.5) × この幅 */
export const LITERACY_ADJUSTMENT_SPAN = 0.1;
export const LITERACY_MAX_SCORE = 5;

/** 現在年収が基準のこの割合未満なら、翌年に基準まで即回復 */
export const INCOME_FLOOR_SNAP_RATIO = 0.25;

/** 基準未満のとき、差額のこの割合を毎年回復 */
export const INCOME_FLOOR_CATCHUP_RATIO = 0.35;

/** 職業別転職率に NW 補正を足したあとのクリップ */
export const TRANSITION_RATE_MIN = 0.2;
export const TRANSITION_RATE_MAX = 0.9;

/** 年齢別・転職後の共通基準年収（万円） */
export const COMMON_TRANSITION_INCOME_BY_AGE = [
  { maxAge: 30, income: 300 },
  { maxAge: 40, income: 350 },
  { maxAge: 50, income: 380 },
  { maxAge: 60, income: 340 },
  { maxAge: 70, income: 250 },
  { maxAge: Infinity, income: 180 },
] as const;

/** 基準年収の年齢補正（occupationIncomeFloor） */
export const FLOOR_PRE_PEAK_MIN = 0.65;
export const FLOOR_PRE_PEAK_DECAY = 0.02;
export const FLOOR_POST_PEAK_MIN = 0.55;
export const FLOOR_POST_PEAK_DECAY = 0.025;

/**
 * 振る舞いフラグ。仕様を変えるときは数値より先にここを検討する。
 * 既定値は v19 時点の意図（レビュー指摘の修正を反映済み）。
 */
export const CALCULATION_BEHAVIOR = {
  /**
   * true: 開始時点ですでに primaryEnd 以上なら、初年度から主職生存率0。
   * false: 初年度は常に生存率1（旧挙動）。
   */
  respectPrimaryEndInFirstYear: true,

  /**
   * true: 基準年収0の職業（無職など）には転職後共通収入を混ぜない。
   * false: キャリアリスク減衰に応じて共通転職後収入が混ざる（旧挙動）。
   */
  disableTransitionForZeroIncomeOccupations: true,

  /**
   * true: 初期資産の元本も時価総額に加算する。
   * false: 運用益（資産所得）だけを加算。
   */
  includeInitialAssetsInMarketCap: true,

  /**
   * true: 引退年齢以降も、残余なしでも資産運用だけ続ける。
   * false: 引退で投影年数0なら給与も資産所得も0（現行）。
   * 有効化する場合は assetProjectionYearsAfterRetirement も設定する。
   */
  projectAssetsAfterRetirement: false,

  /** projectAssetsAfterRetirement が true のとき、引退後に資産だけ投影する年数 */
  assetProjectionYearsAfterRetirement: 0,
} as const;

export type CalculationBehavior = typeof CALCULATION_BEHAVIOR;

export function financialLiteracyAdjustment(correct: number): number {
  const score = Math.min(LITERACY_MAX_SCORE, Math.max(0, correct));
  return (score / LITERACY_MAX_SCORE - 0.5) * LITERACY_ADJUSTMENT_SPAN;
}

export function commonTransitionIncome(age: number): number {
  for (const bracket of COMMON_TRANSITION_INCOME_BY_AGE) {
    if (age < bracket.maxAge) return bracket.income;
  }
  return COMMON_TRANSITION_INCOME_BY_AGE[COMMON_TRANSITION_INCOME_BY_AGE.length - 1].income;
}

export function recoverTowardOccupationFloor(current: number, projected: number, floor: number): number {
  if (floor <= 0) return Math.max(0, projected);
  if (current < floor * INCOME_FLOOR_SNAP_RATIO) return floor;
  if (projected < floor) return projected + (floor - projected) * INCOME_FLOOR_CATCHUP_RATIO;
  return projected;
}

export function clipTransitionIncomeRate(rate: number): number {
  return Math.min(TRANSITION_RATE_MAX, Math.max(TRANSITION_RATE_MIN, rate));
}

/** 基準年収0の職業は「働いていない」扱い。転職後モデルを載せない。 */
export function occupationAllowsTransitionIncome(job: OccupationParam, occupationBaseIncome: number): boolean {
  if (!CALCULATION_BEHAVIOR.disableTransitionForZeroIncomeOccupations) return true;
  return occupationBaseIncome > 0 && job.key !== "unemployed";
}

/**
 * 主職のキャリア生存率。
 * year=0 かつ respectPrimaryEndInFirstYear のときも、年齢が primaryEnd 以上なら 0。
 */
export function careerSurvival(job: OccupationParam, age: number, year: number): number {
  if (age >= job.primaryEnd) {
    if (year === 0 && !CALCULATION_BEHAVIOR.respectPrimaryEndInFirstYear) return 1;
    return 0;
  }
  if (year === 0) return 1;
  return Math.pow(1 - job.careerRisk, year);
}

export function projectionYearCount(age: number, retirement: number): number {
  const remaining = Math.max(0, retirement - age);
  if (remaining > 0) return remaining;
  if (CALCULATION_BEHAVIOR.projectAssetsAfterRetirement) {
    return Math.max(0, CALCULATION_BEHAVIOR.assetProjectionYearsAfterRetirement);
  }
  return 0;
}
