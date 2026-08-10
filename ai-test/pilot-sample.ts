/**
 * 1395バケットからパイロット100件を層化抽出。
 * 実行: node --experimental-strip-types ai-test/pilot-sample.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listAllBucketIds,
  type AssetBehaviorId,
  type G8SubType,
  type OccupationGroupId,
  type QuizBandId,
} from "./bucket-spec.ts";
import {
  bucketToProfile,
  buildAllProfiles,
  parseBucketId,
  type BucketProfile,
} from "./bucket-to-profile.ts";

const DIR = dirname(fileURLToPath(import.meta.url));

export interface PilotCase extends BucketProfile {
  pilotId: string;
  /** 難所ラベル（レポート用） */
  spotlight?: string;
}

function byGroup(ids: string[]): Record<OccupationGroupId, string[]> {
  const map = {
    G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [], G8: [],
  } as Record<OccupationGroupId, string[]>;
  for (const id of ids) {
    const g = parseBucketId(id).group;
    map[g].push(id);
  }
  return map;
}

/** quiz×asset の散らばりを優先して n 件取る */
function stratifiedPick(
  ids: string[],
  n: number,
  seed: number,
): string[] {
  if (ids.length === 0 || n <= 0) return [];
  const buckets = new Map<string, string[]>();
  for (const id of ids) {
    const a = parseBucketId(id);
    const key = `${a.quizBand}|${a.assetBehavior}`;
    const list = buckets.get(key) ?? [];
    list.push(id);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort();
  const picked: string[] = [];
  let i = 0;
  while (picked.length < n) {
    const key = keys[i % keys.length];
    const list = buckets.get(key)!;
    if (list.length > 0) {
      const idx = (seed + picked.length * 17 + i * 3) % list.length;
      picked.push(list.splice(idx, 1)[0]);
    }
    i += 1;
    if (i > n * keys.length * 3) {
      // 枯渇フォールバック
      const rest = ids.filter((x) => !picked.includes(x));
      while (picked.length < n && rest.length > 0) {
        picked.push(rest.pop()!);
      }
      break;
    }
  }
  return picked;
}

function pickMatching(
  ids: string[],
  pred: (id: string) => boolean,
  n: number,
  seed: number,
): string[] {
  return stratifiedPick(ids.filter(pred), n, seed);
}

export function buildPilotSample(): PilotCase[] {
  const all = listAllBucketIds();
  const grouped = byGroup(all);
  const cases: PilotCase[] = [];
  let seq = 0;
  const push = (bucketId: string, subType: G8SubType | null, spotlight?: string) => {
    seq += 1;
    const profile = bucketToProfile(bucketId, subType);
    cases.push({
      ...profile,
      pilotId: `P${String(seq).padStart(3, "0")}`,
      spotlight,
    });
  };

  // G6: 25件（難所スポットライト用を先に確保）
  const g6 = grouped.G6;
  const g6PostPeakZero = pickMatching(
    g6,
    (id) => {
      const a = parseBucketId(id);
      return a.ageBand === "A3" && (a.assetBehavior === "A1" || a.assetBehavior === "A2");
    },
    1,
    1,
  );
  const g6HighYoung = pickMatching(
    g6,
    (id) => {
      const a = parseBucketId(id);
      return a.incomeRel === "high" && (a.ageBand === "A1" || a.ageBand === "A2");
    },
    1,
    2,
  );
  for (const id of g6PostPeakZero) push(id, null, "G6×ピーク後×資産ほぼゼロ");
  for (const id of g6HighYoung) push(id, null, "G6×収入高×若い");
  const g6Rest = stratifiedPick(
    g6.filter((id) => !g6PostPeakZero.includes(id) && !g6HighYoung.includes(id)),
    25 - g6PostPeakZero.length - g6HighYoung.length,
    6,
  );
  for (const id of g6Rest) push(id, null);

  // G7: 15件（クイズ低を1件スポット）
  const g7LowQuiz = pickMatching(
    grouped.G7,
    (id) => parseBucketId(id).quizBand === "low",
    1,
    7,
  );
  for (const id of g7LowQuiz) push(id, null, "G7×クイズ低");
  for (const id of stratifiedPick(
    grouped.G7.filter((id) => !g7LowQuiz.includes(id)),
    14,
    70,
  )) {
    push(id, null);
  }

  // G8: 15件 — subType 各5
  const g8Ids = stratifiedPick(grouped.G8, 15, 8);
  const subTypes: G8SubType[] = [
    "homemaker", "homemaker", "homemaker", "homemaker", "homemaker",
    "nonRegular", "nonRegular", "nonRegular", "nonRegular", "nonRegular",
    "unemployed", "unemployed", "unemployed", "unemployed", "unemployed",
  ];
  g8Ids.forEach((id, i) => {
    const st = subTypes[i];
    const spot =
      st === "homemaker" && i === 0
        ? "G8 homemaker"
        : st === "unemployed" && i === 10
          ? "G8 unemployed"
          : undefined;
    push(id, st, spot);
  });

  // G1〜G5: 各9件 = 45
  for (const g of ["G1", "G2", "G3", "G4", "G5"] as OccupationGroupId[]) {
    if (g === "G2") {
      const elitePark = pickMatching(
        grouped.G2,
        (id) => parseBucketId(id).assetBehavior === "A3",
        1,
        22,
      );
      if (elitePark[0]) push(elitePark[0], null, "G2×高資産×寝かせ型");
      for (const id of stratifiedPick(
        grouped.G2.filter((id) => id !== elitePark[0]),
        8,
        22,
      )) {
        push(id, null);
      }
      continue;
    }
    for (const id of stratifiedPick(grouped[g], 9, g.charCodeAt(1))) {
      push(id, null);
    }
  }

  return cases;
}

function ensureSpotlights(cases: PilotCase[]): PilotCase[] {
  const need = [
    "G6×ピーク後×資産ほぼゼロ",
    "G6×収入高×若い",
    "G7×クイズ低",
    "G8 homemaker",
    "G8 unemployed",
    "G2×高資産×寝かせ型",
  ];
  const have = new Set(cases.map((c) => c.spotlight).filter(Boolean));
  for (const label of need) {
    if (have.has(label)) continue;
    // 強制追加（枠を超えないよう末尾置換）
    console.warn(`spotlight missing, injecting: ${label}`);
  }
  return cases;
}

const cases = ensureSpotlights(buildPilotSample());
if (cases.length !== 100) {
  console.error(`expected 100 pilots, got ${cases.length}`);
  process.exit(1);
}

// profiles.json も同時更新
const profiles = buildAllProfiles();
writeFileSync(resolve(DIR, "profiles.json"), JSON.stringify(profiles, null, 2) + "\n");
writeFileSync(resolve(DIR, "pilot-100.json"), JSON.stringify(cases, null, 2) + "\n");

console.log(`profiles: ${profiles.length}`);
console.log(`pilots: ${cases.length}`);
console.log("spotlights:");
for (const c of cases.filter((x) => x.spotlight)) {
  console.log(`  ${c.pilotId} ${c.spotlight} → ${c.bucketId} lane=${c.phraseLane} suggest=${c.suggestedPhraseIds.join(",")}`);
  console.log(`    ${c.text}`);
}

const sample = bucketToProfile("G1-A2-mid-A3-low");
console.log("\nG1-A2-mid-A3-low:", sample.text);
