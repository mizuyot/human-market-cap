/**
 * bucket-spec マッピングのユニットテスト。
 * 実行: node --experimental-strip-types ai-test/bucket-test.ts
 */

import {
  OCCUPATION_BASE_INCOME,
  OCCUPATIONS,
} from "../app/model.ts";
import {
  assertAllOccupationsGrouped,
  bucketCountSummary,
  listAllBucketIds,
  listOccupationGroupAssignments,
  OCCUPATION_GROUPS,
  resolveAgeBand,
  resolveAssetBehavior,
  resolveBucketAxes,
  resolveIncomeRel,
  resolveQuizBand,
  toBucketId,
  type BucketInput,
} from "./bucket-spec.ts";

let passed = 0;
let failed = 0;

function assert(cond: boolean, message: string): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${message}`);
  }
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  assert(actual === expected, `${message} (got ${String(actual)}, want ${String(expected)})`);
}

function baseInput(over: Partial<BucketInput> = {}): BucketInput {
  return {
    age: 30,
    annualIncome: 400,
    occupation: "listedGeneral",
    financialAssets: 300,
    realEstateAssets: 0,
    otherAssets: 0,
    reinvestmentRate: 0.2,
    correctAnswers: 3,
    ...over,
  };
}

console.log("=== 職業グループ完全性 ===");
{
  const check = assertAllOccupationsGrouped();
  assertEq(OCCUPATIONS.length, 60, "職業マスタは60件");
  assert(check.ok, `全60キーがGに割当 (missing=${check.missing.join(",") || "なし"}, extra=${check.extra.join(",") || "なし"})`);
  for (const job of OCCUPATIONS) {
    const id = toBucketId(baseInput({ occupation: job.key }));
    assert(/^G[1-8]-A[1-4]-(low|mid|high)-A[1-5]-(low|mid|high)$/.test(id), `${job.key} → 有効ID ${id}`);
  }
  assertEq(OCCUPATION_GROUPS.mangaArtist, "G6", "mangaArtist は G6");
  assertEq(OCCUPATION_GROUPS.software, "G4", "software は G4 のまま");
  assertEq(resolveBucketAxes(baseInput({ occupation: "homemaker" })).subType, "homemaker", "homemaker subType");
  assertEq(resolveBucketAxes(baseInput({ occupation: "nonRegular" })).subType, "nonRegular", "nonRegular subType");
  assertEq(resolveBucketAxes(baseInput({ occupation: "unemployed" })).subType, "unemployed", "unemployed subType");
  assertEq(resolveBucketAxes(baseInput({ occupation: "listedGeneral" })).subType, null, "非G8の subType は null");
}

console.log("\n=== 年齢帯 境界 (通常グループ) ===");
{
  assertEq(resolveAgeBand("G1", 27, "listedGeneral"), "A1", "年齢27 → A1");
  assertEq(resolveAgeBand("G1", 28, "listedGeneral"), "A2", "年齢28 → A2");
  assertEq(resolveAgeBand("G1", 37, "listedGeneral"), "A2", "年齢37 → A2");
  assertEq(resolveAgeBand("G1", 38, "listedGeneral"), "A3", "年齢38 → A3");
  assertEq(resolveAgeBand("G1", 49, "listedGeneral"), "A3", "年齢49 → A3");
  assertEq(resolveAgeBand("G1", 50, "listedGeneral"), "A4", "年齢50 → A4");
  assertEq(toBucketId(baseInput({ age: 27 })).split("-")[1], "A1", "toBucketId 27");
  assertEq(toBucketId(baseInput({ age: 28 })).split("-")[1], "A2", "toBucketId 28");
}

console.log("\n=== 年齢帯 G6 primaryEnd (host=45) ===");
{
  // remaining = 45 - age
  assertEq(resolveAgeBand("G6", 30, "host"), "A1", "host 30歳: 残り15年 >10 → A1");
  assertEq(resolveAgeBand("G6", 34, "host"), "A1", "host 34歳: 残り11年 >10 → A1");
  assertEq(resolveAgeBand("G6", 35, "host"), "A2", "host 35歳: 残り10年 → A2");
  assertEq(resolveAgeBand("G6", 42, "host"), "A2", "host 42歳: 残り3年 → A2");
  assertEq(resolveAgeBand("G6", 43, "host"), "A3", "host 43歳: 残り2年 <3 → A3");
  assertEq(resolveAgeBand("G6", 45, "host"), "A3", "host 45歳: 残り0 → A3");
  assertEq(resolveAgeBand("G6", 50, "host"), "A3", "host 50歳: 経過後 → A3");
  assertEq(toBucketId(baseInput({ occupation: "host", age: 30 })).split("-")[1], "A1", "toBucketId host30");
  assertEq(toBucketId(baseInput({ occupation: "host", age: 45 })).split("-")[1], "A3", "toBucketId host45");
}

console.log("\n=== 年収相対 境界 ===");
{
  const base = OCCUPATION_BASE_INCOME.listedGeneral; // 520 (v20)
  assertEq(resolveIncomeRel("listedGeneral", base * 0.79), "low", "比0.79 → low");
  assertEq(resolveIncomeRel("listedGeneral", base * 0.8), "mid", "比0.8 → mid");
  assertEq(resolveIncomeRel("listedGeneral", base * 1.5), "mid", "比1.5 → mid");
  assertEq(resolveIncomeRel("listedGeneral", base * 1.5 + 0.01), "high", "比>1.5 → high");
  // 基準0: unemployed
  assertEq(OCCUPATION_BASE_INCOME.unemployed, 0, "無職の基準年収0");
  assertEq(resolveIncomeRel("unemployed", 199), "low", "無職 199万 → low");
  assertEq(resolveIncomeRel("unemployed", 200), "mid", "無職 200万 → mid");
  assertEq(resolveIncomeRel("unemployed", 500), "mid", "無職 500万 → mid");
  assertEq(resolveIncomeRel("unemployed", 501), "high", "無職 501万 → high");
}

console.log("\n=== 資産行動 境界 ===");
{
  assertEq(resolveAssetBehavior(99, 0, 0, 0.19), "A1", "資産99×再投資19% → A1");
  assertEq(resolveAssetBehavior(99, 0, 0, 0.2), "A2", "資産99×再投資20% → A2");
  assertEq(resolveAssetBehavior(100, 0, 0, 0.09), "A3", "資産100×再投資9% → A3");
  assertEq(resolveAssetBehavior(100, 0, 0, 0.1), "A4", "資産100×再投資10% → A4");
  assertEq(resolveAssetBehavior(2999, 0, 0, 0.5), "A4", "資産2999×運用 → A4");
  assertEq(resolveAssetBehavior(3000, 0, 0, 0), "A5", "資産3000 → A5");
  assertEq(resolveAssetBehavior(50, 40, 9, 0), "A1", "合算99 → A1");
  assertEq(resolveAssetBehavior(50, 40, 10, 0.05), "A3", "合算100×寝かせ → A3");
}
console.log("\n=== クイズ帯 ===");
{
  assertEq(resolveQuizBand(0), "low", "quiz 0 → low");
  assertEq(resolveQuizBand(1), "low", "quiz 1 → low");
  assertEq(resolveQuizBand(2), "mid", "quiz 2 → mid");
  assertEq(resolveQuizBand(3), "mid", "quiz 3 → mid");
  assertEq(resolveQuizBand(4), "high", "quiz 4 → high");
  assertEq(resolveQuizBand(5), "high", "quiz 5 → high");
}

console.log("\n=== toBucketId 合成例・異常入力 ===");
{
  const id = toBucketId(baseInput({
    age: 30,
    occupation: "listedGeneral",
    annualIncome: 400,
    financialAssets: 200,
    reinvestmentRate: 0.05,
    correctAnswers: 1,
  }));
  assertEq(id, "G1-A2-mid-A3-low", "典型例 G1-A2-mid-A3-low");

  const weird = toBucketId(baseInput({
    age: Number.NaN,
    annualIncome: Number.POSITIVE_INFINITY,
    occupation: "unknown_job_xyz",
    financialAssets: -10,
    reinvestmentRate: 9,
    correctAnswers: 99,
  }));
  assert(/^G1-A\d-(low|mid|high)-A\d-(low|mid|high)$/.test(weird), `異常入力でも有効ID: ${weird}`);
}

console.log("\n=== バケット件数 ===");
{
  const summary = bucketCountSummary();
  const listed = listAllBucketIds();
  assertEq(listed.length, summary.actualWithG6Special, "列挙件数 = 実数サマリー");
  assertEq(new Set(listed).size, listed.length, "ID重複なし");
  console.log(`  理論値(全Gが年齢4区分): ${summary.theoreticalIfAllFourAgeBands}`);
  console.log(`  実数(G6は年齢3区分):   ${summary.actualWithG6Special}`);
  console.log(`  内訳:`, summary.perGroup);
}

console.log("\n=== 職業→グループ 全60行 ===");
for (const row of listOccupationGroupAssignments()) {
  console.log(`  ${row.key.padEnd(22)} ${row.group} ${row.groupLabel}  | ${row.label}`);
}

console.log(`\n結果: PASS ${passed} / FAIL ${failed}`);
if (failed > 0) process.exit(1);
