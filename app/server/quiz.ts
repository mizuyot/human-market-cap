import type { PublicQuizSet, QuizAnswers, QuizReviewItem, QuizSetAnswer } from "../api-types";
import { QUIZ_SETS, type QuizSet, isQuizSetCorrect } from "../quiz-data";

export function toPublicQuizSet(set: QuizSet): PublicQuizSet {
  return {
    id: set.id,
    title: set.title,
    ...(set.lead ? { lead: set.lead } : {}),
    a: { prompt: set.a.prompt, options: [...set.a.options] },
    b: { prompt: set.b.prompt, options: [...set.b.options] },
  };
}

export function pickQuizSets(count = 5): QuizSet[] {
  const list = [...QUIZ_SETS];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

export function getQuizSetsByIds(ids: string[]): QuizSet[] {
  const byId = new Map(QUIZ_SETS.map((set) => [set.id, set]));
  const sets = ids.map((id) => byId.get(id)).filter((set): set is QuizSet => Boolean(set));
  return sets.length === ids.length ? sets : [];
}

export function normalizeAnswers(sets: QuizSet[], answers: QuizAnswers): QuizAnswers {
  const normalized: QuizAnswers = {};
  for (const set of sets) {
    const answer = answers?.[set.id];
    normalized[set.id] = {
      a: normalizeChoice(answer?.a, set.a.options.length),
      b: normalizeChoice(answer?.b, set.b.options.length),
    };
  }
  return normalized;
}

function normalizeChoice(value: unknown, optionCount: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) >= optionCount) return null;
  return Number(value);
}

export function scoreQuiz(sets: QuizSet[], answers: QuizAnswers): number {
  return sets.filter((set) => isQuizSetCorrect(set, answers[set.id])).length;
}

export function buildQuizReviews(sets: QuizSet[], answers: QuizAnswers): QuizReviewItem[] {
  return sets.map((set) => ({
    ...toPublicQuizSet(set),
    answer: answers[set.id] ?? { a: null, b: null },
    passed: isQuizSetCorrect(set, answers[set.id] as QuizSetAnswer | undefined),
    correctPattern: set.correctPattern,
    explanation: set.explanation,
  }));
}
