import { getTier } from "../model.ts";
import { quizThemeForId } from "./quiz-theme-map.ts";
import type {
  CapitalStyle,
  CommentLabels,
  CommentSelectionInput,
  DeltaBand,
  MarketTone,
  PositionBand,
  QuizBand,
  QuizTheme,
  RiskBucket,
  TimePhase,
} from "./types.ts";

const THEME_TIEBREAK: QuizTheme[] = ["math", "risk", "bias", "consistency"];

/**
 * timePhase thresholds (documented):
 * - late: yearsRemaining < 10 OR age >= occupationPrimaryEnd
 * - peak: age in [occupationPeak - 3, occupationPeak + 5] (and not late)
 * - runway: age < occupationPeak - 8 OR (yearsRemaining > 25 && age < occupationPeak - 3)
 * - else growth
 */
export function computeTimePhase(input: CommentSelectionInput): TimePhase {
  const { age, yearsRemaining, occupationPeak, occupationPrimaryEnd } = input;
  if (yearsRemaining < 10 || age >= occupationPrimaryEnd) return "late";
  if (age >= occupationPeak - 3 && age <= occupationPeak + 5) return "peak";
  if (age < occupationPeak - 8 || (yearsRemaining > 25 && age < occupationPeak - 3)) {
    return "runway";
  }
  return "growth";
}

/**
 * marketTone: growth if timePhase is runway|growth AND salary-dominant
 * (salaryIncomeMan >= assetIncomeMan + initialAssets * 0.15); else structure.
 */
export function computeMarketTone(
  input: CommentSelectionInput,
  timePhase: TimePhase,
): MarketTone {
  const initialAssets = input.financialAssets + input.realEstateAssets + input.otherAssets;
  const salaryDominant =
    input.salaryIncomeMan >= input.assetIncomeMan + initialAssets * 0.15;
  if ((timePhase === "runway" || timePhase === "growth") && salaryDominant) {
    return "growth";
  }
  return "structure";
}

/**
 * riskBucket from occupationCareerRisk:
 * <=0.012 stable, <=0.02 resilient, <=0.035 balanced, <=0.06 volatile, else extreme
 */
export function computeRiskBucket(careerRisk: number): RiskBucket {
  if (careerRisk <= 0.012) return "stable";
  if (careerRisk <= 0.02) return "resilient";
  if (careerRisk <= 0.035) return "balanced";
  if (careerRisk <= 0.06) return "volatile";
  return "extreme";
}

/**
 * capitalStyle from salary / asset flow / stock mix (+ reinvestment / runway).
 * total = core + assetsFlow + stock (career option excluded from ratio base).
 */
export function computeCapitalStyle(input: CommentSelectionInput): CapitalStyle {
  const core = input.salaryIncomeMan;
  const assetsFlow = input.assetIncomeMan;
  const stock = input.financialAssets + input.realEstateAssets + input.otherAssets;
  const total = core + assetsFlow + stock;
  if (total <= 0) return "human";

  const stockShare = stock / total;
  const coreShare = core / total;
  const capitalShare = (assetsFlow + stock) / total;

  if (stockShare >= 0.45) return "capital";
  if (coreShare >= 0.55 && input.reinvestmentRate >= 0.25 && input.yearsRemaining >= 15) {
    return "compound";
  }
  if (coreShare >= 0.5 && capitalShare >= 0.28) return "dual";
  if (coreShare >= 0.55) return "human";
  if (stockShare >= 0.35) return "capital";
  return "dual";
}

export function computeQuizBand(quizCorrect: number): QuizBand {
  if (quizCorrect >= 5) return "master";
  if (quizCorrect >= 3) return "steady";
  if (quizCorrect >= 2) return "developing";
  return "review";
}

/**
 * Among wrongQuizIds, pick the theme with the most wrongs.
 * Tie-break order: math, risk, bias, consistency.
 * null if no wrongs or quizBand === master.
 */
export function computeQuizTheme(
  wrongQuizIds: string[],
  quizBand: QuizBand,
): QuizTheme | null {
  if (quizBand === "master" || wrongQuizIds.length === 0) return null;

  const counts: Record<QuizTheme, number> = {
    math: 0,
    risk: 0,
    bias: 0,
    consistency: 0,
  };
  for (const id of wrongQuizIds) {
    const theme = quizThemeForId(id);
    if (theme) counts[theme] += 1;
  }

  let best: QuizTheme | null = null;
  let bestCount = 0;
  for (const theme of THEME_TIEBREAK) {
    const n = counts[theme];
    if (n > bestCount) {
      best = theme;
      bestCount = n;
    }
  }
  return bestCount > 0 ? best : null;
}

/**
 * positionBand from rankingTopPercent (lower = better):
 * <=10 top10, <=30 top30, <50 aboveMarket, else rebuild.
 * null if ranking missing.
 */
export function computePositionBand(rankingTopPercent: number | null): PositionBand | null {
  if (rankingTopPercent === null) return null;
  if (rankingTopPercent <= 10) return "top10";
  if (rankingTopPercent <= 30) return "top30";
  if (rankingTopPercent < 50) return "aboveMarket";
  return "rebuild";
}

function formatDeltaText(diffYen: number): string {
  const sign = diffYen >= 0 ? "+" : "−";
  const man = Math.round(Math.abs(diffYen) / 10000);
  return `${sign}${man.toLocaleString("ja-JP")}万円`;
}

/**
 * deltaBand: pct = (scoreYen - previous) / max(previous, 1)
 * >=0.05 up, <=-0.05 down, else flat. null if no previous.
 */
export function computeDelta(
  scoreYen: number,
  previousScoreYen: number | null,
): { deltaBand: DeltaBand | null; deltaText: string | null } {
  if (previousScoreYen === null) {
    return { deltaBand: null, deltaText: null };
  }
  const diff = scoreYen - previousScoreYen;
  const pct = diff / Math.max(previousScoreYen, 1);
  const deltaBand: DeltaBand = pct >= 0.05 ? "up" : pct <= -0.05 ? "down" : "flat";
  return { deltaBand, deltaText: formatDeltaText(diff) };
}

/**
 * hiddenTitleKey mirrors getHiddenTitle in HumanMarketCapApp.tsx
 * (tokyoKyotoGraduate, not catalog typo tokyoKyotoDoctor).
 */
export function computeHiddenTitleKey(input: CommentSelectionInput): string | null {
  const totalAssets = input.financialAssets + input.realEstateAssets + input.otherAssets;
  const tier = getTier(input.marketCapMan);

  if (input.education === "middleSchool" && input.occupation === "fund") {
    return "gekokujo";
  }
  if (input.education === "tokyoKyotoGraduate" && input.occupation === "nonRegular") {
    return "high-education-working-poor";
  }
  if (input.appearance === "top10" && input.occupation === "professionalGambler") {
    return "treasure-wasted";
  }
  if (input.occupation === "unemployed" && totalAssets >= 10_000) {
    return "unemployed-capitalist";
  }
  if (input.occupation === "aiEngineer" && input.age <= 30 && tier === "S") {
    return "ai-top-pick";
  }
  if (
    (input.occupation === "pokerLive" || input.occupation === "pokerOnline") &&
    input.quizCorrect === 5 &&
    input.financialAssets < 100
  ) {
    return "ev-millionaire";
  }
  if (
    input.occupation === "public" &&
    totalAssets >= 5_000 &&
    input.reinvestmentRate >= 0.4
  ) {
    return "quiet-capitalist";
  }
  if (
    input.rankingDeviation !== null &&
    input.rankingDeviation.toFixed(1) === "50.0"
  ) {
    return "perfect-average";
  }
  return null;
}

export function computeCommentLabels(input: CommentSelectionInput): CommentLabels {
  const timePhase = computeTimePhase(input);
  const marketTone = computeMarketTone(input, timePhase);
  const riskBucket = computeRiskBucket(input.occupationCareerRisk);
  const capitalStyle = computeCapitalStyle(input);
  const quizBand = computeQuizBand(input.quizCorrect);
  const quizTheme = computeQuizTheme(input.wrongQuizIds, quizBand);
  const positionBand = computePositionBand(input.rankingTopPercent);
  const { deltaBand, deltaText } = computeDelta(input.scoreYen, input.previousScoreYen);
  const hiddenTitleKey = computeHiddenTitleKey(input);
  const tier = getTier(input.marketCapMan);

  return {
    tier,
    marketTone,
    timePhase,
    riskBucket,
    capitalStyle,
    quizBand,
    quizTheme,
    positionBand,
    deltaBand,
    deltaText,
    hiddenTitleKey,
    rankingReady: input.rankingTopPercent !== null,
  };
}
