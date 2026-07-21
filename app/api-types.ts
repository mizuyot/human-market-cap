import type { CalculatorInputs, CalculationResult } from "./model";

export interface PublicQuizPart {
  prompt: string;
  options: string[];
}

export interface PublicQuizSet {
  id: string;
  title: string;
  lead?: string;
  a: PublicQuizPart;
  b: PublicQuizPart;
}

export interface QuizSetAnswer {
  a: number | null;
  b: number | null;
}

export type QuizAnswers = Record<string, QuizSetAnswer>;

export interface SegmentRanking {
  kind: "occupation" | "age" | "education";
  label: string;
  rank: number;
  total: number;
}

export interface QuizReviewItem extends PublicQuizSet {
  answer: QuizSetAnswer;
  passed: boolean;
  correctPattern: string;
  explanation: string;
}

export interface RankingSnapshot {
  rank: number;
  total: number;
  deviation: number;
  topPercent: number;
  bins: number[];
  minScore: number;
  maxScore: number;
  mode: "global";
  segments: SegmentRanking[];
}

export interface QuizStartResponse {
  attemptId: string;
  sets: PublicQuizSet[];
  expiresAt: number;
}

export interface ValuationRequest {
  attemptId: string;
  uid: string;
  inputs: CalculatorInputs;
  answers: QuizAnswers;
}

export interface ValuationResponse {
  calculation: CalculationResult;
  scoreYen: number;
  quizCorrect: number;
  reviews: QuizReviewItem[];
  ranking: RankingSnapshot;
}
