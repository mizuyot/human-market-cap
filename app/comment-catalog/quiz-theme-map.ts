import type { QuizTheme } from "./types.ts";

/**
 * Maps each quiz set id in app/quiz-data.ts to a comment theme.
 * math: calculation / compound / fees / inflation
 * risk: insurance / debt / kelly / concentration
 * bias: sunk cost / framing / house money / endowment
 * consistency: same-value consistency / present bias
 */
export const QUIZ_THEME_BY_ID: Record<string, QuizTheme> = {
  q01: "risk", // insurance
  q02: "risk", // debt
  q03: "math", // calculation (+50% / −50%)
  q04: "bias", // sunk cost
  q05: "consistency", // same-value consistency
  q06: "math", // compound
  q07: "risk", // kelly
  q08: "consistency", // present bias / time consistency
  q09: "risk", // concentration
  q10: "math", // fees
  q11: "bias", // framing / loss aversion
  q12: "bias", // house money
  q13: "bias", // endowment
  q14: "math", // wage / inflation
  q15: "bias", // endowment / status quo
};

export function quizThemeForId(id: string): QuizTheme | null {
  return QUIZ_THEME_BY_ID[id] ?? null;
}
