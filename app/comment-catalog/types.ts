export type CommentSlot = "special" | "headline" | "career" | "capital" | "insight" | "fallback" | "position";
export type MarketTone = "growth" | "structure";
export type TimePhase = "runway" | "growth" | "peak" | "late";
export type RiskBucket = "stable" | "resilient" | "balanced" | "volatile" | "extreme";
export type CapitalStyle = "human" | "compound" | "capital" | "dual";
export type QuizBand = "master" | "steady" | "developing" | "review";
export type QuizTheme = "math" | "risk" | "bias" | "consistency";
export type PositionBand = "top10" | "top30" | "aboveMarket" | "rebuild";
export type DeltaBand = "up" | "flat" | "down";
export type Tier = "S" | "A" | "B" | "C" | "D";

export interface CatalogEntry {
  id: string;
  slot: CommentSlot;
  category: string;
  /** Matching keys; null/undefined means not constrained */
  match: {
    tier?: Tier;
    marketTone?: MarketTone;
    timePhase?: TimePhase;
    riskBucket?: RiskBucket;
    capitalStyle?: CapitalStyle;
    quizBand?: QuizBand;
    quizTheme?: QuizTheme;
    positionBand?: PositionBand;
    deltaBand?: DeltaBand;
    titleKey?: string; // for special titles
    fallbackKind?: "standard" | "ranking-wait" | "boundary";
  };
  variantIndex: number | null; // null if sole entry for match; 0..n for variants
  title: string;
  body: string; // may include {{delta}}
}

export interface CommentLabels {
  tier: Tier;
  marketTone: MarketTone;
  timePhase: TimePhase;
  riskBucket: RiskBucket;
  capitalStyle: CapitalStyle;
  quizBand: QuizBand;
  quizTheme: QuizTheme | null; // null if no clear wrong theme
  positionBand: PositionBand | null;
  deltaBand: DeltaBand | null;
  deltaText: string | null; // e.g. "+123万円"
  hiddenTitleKey: string | null; // gekokujo, high-education-working-poor, etc.
  rankingReady: boolean;
}

export interface SelectedComment {
  id: string;
  slot: "special" | "headline" | "career" | "capital" | "insight";
  title: string;
  body: string;
}

export interface CommentSelectionInput {
  age: number;
  annualIncome: number;
  education: string;
  appearance: string;
  occupation: string;
  financialAssets: number;
  realEstateAssets: number;
  otherAssets: number;
  reinvestmentRate: number;
  quizCorrect: number;
  /** quiz set ids that were wrong this attempt */
  wrongQuizIds: string[];
  /** all quiz set ids in this attempt (for theme scope) */
  quizSetIds: string[];
  marketCapMan: number;
  salaryIncomeMan: number;
  assetIncomeMan: number;
  careerOptionMan: number;
  yearsRemaining: number;
  occupationPeak: number;
  occupationPrimaryEnd: number;
  occupationCareerRisk: number;
  occupationRetirement: number;
  rankingTopPercent: number | null;
  rankingDeviation: number | null;
  previousScoreYen: number | null;
  scoreYen: number;
}
