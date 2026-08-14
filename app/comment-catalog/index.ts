export { COMMENT_CATALOG, assertCatalogIntegrity } from "./catalog.ts";
export { computeCommentLabels } from "./labels.ts";
export { QUIZ_THEME_BY_ID, quizThemeForId } from "./quiz-theme-map.ts";
export { pickVariant, selectResultComments, stableHash } from "./select.ts";
export type {
  CapitalStyle,
  CatalogEntry,
  CommentLabels,
  CommentSelectionInput,
  CommentSlot,
  DeltaBand,
  MarketTone,
  PositionBand,
  QuizBand,
  QuizTheme,
  RiskBucket,
  SelectedComment,
  Tier,
  TimePhase,
} from "./types.ts";
