import { COMMENT_CATALOG } from "./catalog.ts";
import { computeCommentLabels } from "./labels.ts";
import type {
  CatalogEntry,
  CommentSelectionInput,
  SelectedComment,
} from "./types.ts";

/** Stable djb2 hash over a normalized input key (no RNG). */
export function stableHash(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function selectionHashKey(input: CommentSelectionInput): string {
  return JSON.stringify({
    age: input.age,
    annualIncome: input.annualIncome,
    occupation: input.occupation,
    financialAssets: input.financialAssets,
    realEstateAssets: input.realEstateAssets,
    otherAssets: input.otherAssets,
    reinvestmentRate: input.reinvestmentRate,
    quizCorrect: input.quizCorrect,
    education: input.education,
    appearance: input.appearance,
  });
}

export function pickVariant(entries: CatalogEntry[], hash: number): CatalogEntry {
  if (entries.length === 0) {
    throw new Error("pickVariant: empty entries");
  }
  const sorted = [...entries].sort((a, b) => {
    const av = a.variantIndex ?? 0;
    const bv = b.variantIndex ?? 0;
    if (av !== bv) return av - bv;
    return a.id.localeCompare(b.id);
  });
  return sorted[hash % sorted.length]!;
}

function toSelected(
  entry: CatalogEntry,
  slot: SelectedComment["slot"],
  deltaText: string | null,
): SelectedComment {
  const body =
    deltaText !== null && entry.body.includes("{{delta}}")
      ? entry.body.replaceAll("{{delta}}", deltaText)
      : entry.body.replaceAll("{{delta}}", "");
  return {
    id: entry.id,
    slot,
    title: entry.title,
    body,
  };
}

function fallbackStandard(deltaText: string | null): SelectedComment {
  const entry =
    COMMENT_CATALOG.find((e) => e.id === "fallback-standard") ??
    COMMENT_CATALOG[0]!;
  return toSelected(entry, "headline", deltaText);
}

function findByTitleKey(titleKey: string): CatalogEntry | undefined {
  return COMMENT_CATALOG.find((e) => e.match.titleKey === titleKey);
}

function findHeadline(tier: string, marketTone: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.match.tier === tier && e.match.marketTone === marketTone,
  );
}

function findCareer(timePhase: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.id.startsWith("career-") && e.match.timePhase === timePhase,
  );
}

function findRisk(riskBucket: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.id.startsWith("risk-") && e.match.riskBucket === riskBucket,
  );
}

function findCapital(capitalStyle: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.id.startsWith("capital-") && e.match.capitalStyle === capitalStyle,
  );
}

function findQuiz(quizBand: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.id.startsWith("quiz-") && e.match.quizBand === quizBand,
  );
}

function findTheme(quizTheme: string): CatalogEntry[] {
  return COMMENT_CATALOG.filter(
    (e) => e.id.startsWith("theme-") && e.match.quizTheme === quizTheme,
  );
}

function findDelta(deltaBand: string): CatalogEntry | undefined {
  return COMMENT_CATALOG.find(
    (e) => e.id.startsWith("delta-") && e.match.deltaBand === deltaBand,
  );
}

/**
 * Returns up to 4 display slots:
 * 1. special (hidden title) or headline
 * 2. career (risk-* when extreme, else career-{timePhase}-*)
 * 3. capital
 * 4. insight (delta up/down, else theme, else quiz band)
 */
export function selectResultComments(input: CommentSelectionInput): SelectedComment[] {
  const labels = computeCommentLabels(input);
  const hash = stableHash(selectionHashKey(input));
  const deltaText = labels.deltaText;
  const out: SelectedComment[] = [];

  // 1. special or headline
  if (labels.hiddenTitleKey) {
    const special = findByTitleKey(labels.hiddenTitleKey);
    if (special) out.push(toSelected(special, "special", deltaText));
  }
  if (out.length === 0) {
    const headlines = findHeadline(labels.tier, labels.marketTone);
    if (headlines.length > 0) {
      out.push(toSelected(pickVariant(headlines, hash), "headline", deltaText));
    } else {
      out.push(fallbackStandard(deltaText));
    }
  }

  // 2. career (extreme → risk)
  {
    let picked: CatalogEntry | undefined;
    if (labels.riskBucket === "extreme") {
      const risks = findRisk("extreme");
      if (risks.length > 0) picked = pickVariant(risks, hash);
    } else {
      const careers = findCareer(labels.timePhase);
      if (careers.length > 0) picked = pickVariant(careers, hash);
    }
    out.push(
      picked
        ? toSelected(picked, "career", deltaText)
        : fallbackStandard(deltaText),
    );
    if (!picked) {
      // keep slot as career even for fallback body
      out[out.length - 1] = { ...out[out.length - 1]!, slot: "career" };
    }
  }

  // 3. capital
  {
    const capitals = findCapital(labels.capitalStyle);
    if (capitals.length > 0) {
      out.push(toSelected(pickVariant(capitals, hash), "capital", deltaText));
    } else {
      const fb = fallbackStandard(deltaText);
      out.push({ ...fb, slot: "capital" });
    }
  }

  // 4. insight
  {
    let picked: CatalogEntry | undefined;
    if (
      (labels.deltaBand === "up" || labels.deltaBand === "down") &&
      input.previousScoreYen !== null
    ) {
      picked = findDelta(labels.deltaBand);
    } else if (labels.quizBand !== "master" && labels.quizTheme) {
      const themes = findTheme(labels.quizTheme);
      if (themes.length > 0) picked = pickVariant(themes, hash);
    }
    if (!picked) {
      const quizzes = findQuiz(labels.quizBand);
      if (quizzes.length > 0) picked = pickVariant(quizzes, hash);
    }
    if (picked) {
      out.push(toSelected(picked, "insight", deltaText));
    } else {
      const fb = fallbackStandard(deltaText);
      out.push({ ...fb, slot: "insight" });
    }
  }

  return out.slice(0, 4);
}
