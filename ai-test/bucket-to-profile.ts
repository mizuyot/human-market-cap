/**
 * バケットID → 属性記述文（テンプレートのみ、LLM不使用）。
 */

import {
  listAllBucketIds,
  type AgeBandId,
  type AssetBehaviorId,
  type G8SubType,
  type IncomeRelId,
  type OccupationGroupId,
  type QuizBandId,
  OCCUPATION_GROUP_LABELS,
} from "./bucket-spec.ts";

export interface ParsedBucketId {
  group: OccupationGroupId;
  ageBand: AgeBandId;
  incomeRel: IncomeRelId;
  assetBehavior: AssetBehaviorId;
  quizBand: QuizBandId;
}

export interface BucketProfile {
  bucketId: string;
  group: OccupationGroupId;
  groupLabel: string;
  axes: ParsedBucketId;
  /** G8のとき指定。属性文の分岐に使用 */
  subType: G8SubType | null;
  text: string;
  hint: string;
  /** 推奨フレーズレーン */
  phraseLane: "humor" | "serious";
  /** 推奨フレーズID（ヒント。強制ではない） */
  suggestedPhraseIds: string[];
}

const GROUP_HINTS: Record<OccupationGroupId, string> = {
  G1: "コメント核: 入金力と時間",
  G2: "コメント核: 稼げるうちの資産転換",
  G3: "コメント核: 人的資本が最強資産",
  G4: "コメント核: スキル再投資",
  G5: "コメント核: 事業と個人資産の分離",
  G6: "コメント核: 稼げる窓の短さ",
  G7: "コメント核: バンクロール管理が本業",
  G8: "コメント核: 就労状態に応じた防衛と再設計",
};

const G8_SUBTYPE_HINTS: Record<G8SubType, string> = {
  homemaker: "コメント核: 世帯の家計運営・世帯資産の運用判断者としての側面",
  nonRegular: "コメント核: 防衛資金の優先度が最も高い層",
  unemployed: "コメント核: 再稼働時の選択肢設計が主題",
};

const G8_OPENERS: Record<G8SubType, string> = {
  homemaker:
    "世帯の家計運営を担う立場。世帯資産の運用判断者としての側面を持つ。",
  nonRegular:
    "雇用が不安定で賃金上昇が緩やか。防衛資金の優先度が最も高い層。",
  unemployed: "現在就労なし。再稼働時の選択肢設計が主題。",
};

export function parseBucketId(bucketId: string): ParsedBucketId {
  const parts = bucketId.split("-");
  if (parts.length !== 5) {
    throw new Error(`不正なバケットID: ${bucketId}`);
  }
  const [group, ageBand, incomeRel, assetBehavior, quizBand] = parts;
  return {
    group: group as OccupationGroupId,
    ageBand: ageBand as AgeBandId,
    incomeRel: incomeRel as IncomeRelId,
    assetBehavior: assetBehavior as AssetBehaviorId,
    quizBand: quizBand as QuizBandId,
  };
}

function ageBandSentence(group: OccupationGroupId, ageBand: AgeBandId): string {
  if (group === "G6") {
    if (ageBand === "A1") return "主戦場の残り年数は10年超。";
    if (ageBand === "A2") return "主戦場の残り年数は3〜10年。";
    return "主戦場の残り年数は3年未満、またはピーク経過後。";
  }
  if (ageBand === "A1") return "18〜27歳。";
  if (ageBand === "A2") return "28〜37歳。";
  if (ageBand === "A3") return "38〜49歳。";
  return "50歳以上。";
}

function incomeSentence(incomeRel: IncomeRelId): string {
  if (incomeRel === "low") return "年収は職種水準より低め。";
  if (incomeRel === "high") return "年収は職種水準より高め。";
  return "年収は職種水準並み。";
}

function assetSentence(assetBehavior: AssetBehaviorId): string {
  switch (assetBehavior) {
    case "A1":
      return "資産はほぼゼロ（100万円未満）で、再投資率も20%未満。";
    case "A2":
      return "資産はほぼゼロ（100万円未満）だが、再投資率は20%以上。";
    case "A3":
      return "資産は100万〜3000万円あるが再投資率10%未満で寝かせ気味。";
    case "A4":
      return "資産は100万〜3000万円あり、再投資率10%以上で運用寄り。";
    case "A5":
      return "高資産（3000万円以上）。";
  }
}

function quizSentence(quizBand: QuizBandId): string {
  if (quizBand === "low") return "金融クイズ正答率は低い（0〜1点/5点）。";
  if (quizBand === "high") return "金融クイズ正答率は高い（4〜5点/5点）。";
  return "金融クイズ正答率は中程度（2〜3点/5点）。";
}

function groupOpener(group: OccupationGroupId): string {
  switch (group) {
    case "G1":
      return "安定志向の会社員系職種。";
    case "G2":
      return "高収入エリート系職種。";
    case "G3":
      return "専門資格・専門キャリア系職種。";
    case "G4":
      return "テック・知識労働系職種。";
    case "G5":
      return "独立・経営系職種。";
    case "G6":
      return "短期集中型（芸能・夜職・ヒット依存）の職種。";
    case "G7":
      return "ギャンブル・専業トレーダー系職種。";
    case "G8":
      return "非就労または低安定雇用の層。";
  }
}

function buildText(
  axes: ParsedBucketId,
  subType: G8SubType | null,
): string {
  const parts: string[] = [];
  if (axes.group === "G8" && subType) {
    parts.push(G8_OPENERS[subType]);
  } else {
    parts.push(groupOpener(axes.group));
  }
  parts.push(ageBandSentence(axes.group, axes.ageBand));
  parts.push(incomeSentence(axes.incomeRel));
  parts.push(assetSentence(axes.assetBehavior));
  parts.push(quizSentence(axes.quizBand));
  return parts.join(" ");
}

function resolvePhraseHints(axes: ParsedBucketId): {
  phraseLane: "humor" | "serious";
  suggestedPhraseIds: string[];
} {
  // G6 ピーク前後・高収入 → H14 serious
  if (axes.group === "G6" && axes.incomeRel === "high" && (axes.ageBand === "A1" || axes.ageBand === "A2")) {
    return { phraseLane: "serious", suggestedPhraseIds: ["H14"] };
  }
  // G6 ピーク後 → H15 serious
  if (axes.group === "G6" && axes.ageBand === "A3") {
    return { phraseLane: "serious", suggestedPhraseIds: ["H15"] };
  }
  // 寝かせ型・資産あり → H06
  if (axes.assetBehavior === "A3" || axes.assetBehavior === "A5") {
    return { phraseLane: "humor", suggestedPhraseIds: ["H06"] };
  }
  // 資産ほぼゼロ・再投資あり
  if (axes.assetBehavior === "A2") {
    return { phraseLane: "humor", suggestedPhraseIds: ["H11", "H07"] };
  }
  if (axes.assetBehavior === "A1") {
    return { phraseLane: "humor", suggestedPhraseIds: ["H11", "H08"] };
  }
  if (axes.quizBand === "high" && (axes.assetBehavior === "A4" || axes.incomeRel === "high")) {
    return { phraseLane: "humor", suggestedPhraseIds: ["H13"] };
  }
  if (axes.group === "G7") {
    return { phraseLane: "humor", suggestedPhraseIds: ["H09", "H07"] };
  }
  return { phraseLane: "humor", suggestedPhraseIds: [] };
}

export function bucketToProfile(
  bucketId: string,
  subType: G8SubType | null = null,
): BucketProfile {
  const axes = parseBucketId(bucketId);
  const effectiveSub =
    axes.group === "G8" ? (subType ?? "unemployed") : null;
  const hint =
    axes.group === "G8" && effectiveSub
      ? G8_SUBTYPE_HINTS[effectiveSub]
      : GROUP_HINTS[axes.group];
  const phrase = resolvePhraseHints(axes);
  return {
    bucketId,
    group: axes.group,
    groupLabel: OCCUPATION_GROUP_LABELS[axes.group],
    axes,
    subType: effectiveSub,
    text: buildText(axes, effectiveSub),
    hint,
    phraseLane: phrase.phraseLane,
    suggestedPhraseIds: phrase.suggestedPhraseIds,
  };
}

/** 全1395バケット。G8は textsBySubType に3分岐を格納 */
export function buildAllProfiles(): Array<
  BucketProfile & { textsBySubType?: Record<G8SubType, string> }
> {
  return listAllBucketIds().map((bucketId) => {
    const axes = parseBucketId(bucketId);
    if (axes.group === "G8") {
      const base = bucketToProfile(bucketId, "unemployed");
      return {
        ...base,
        textsBySubType: {
          homemaker: buildText(axes, "homemaker"),
          nonRegular: buildText(axes, "nonRegular"),
          unemployed: buildText(axes, "unemployed"),
        },
      };
    }
    return bucketToProfile(bucketId, null);
  });
}
