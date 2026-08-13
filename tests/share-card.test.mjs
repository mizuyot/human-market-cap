import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const sourceUrl = new URL("../app/HumanMarketCapApp.tsx", import.meta.url);

test("result sharing creates a social image with a mobile fallback", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /canvas\.width = 1200/);
  assert.match(source, /canvas\.height = 630/);
  assert.match(source, /#人間時価総額/);
  assert.match(source, /あなたも算出してみる →/);
  assert.match(source, /金融リテラシー \$\{payload\.quiz\}/);
  assert.match(source, /称号：\$\{payload\.title\}/);
  assert.match(source, /searchParams\.set\("challenge"/);
  assert.match(source, /navigator\.canShare/);
  assert.match(source, /new File\(\[bytes\], "human-market-cap-result\.png"/);
  assert.match(source, /https:\/\/x\.com\/intent\/post/);
});

test("share cards include rarity, market metaphors, and quiz badges", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /下剋上/);
  assert.match(source, /高学歴ワーキングプア/);
  assert.match(source, /宝の持ち腐れ/);
  assert.match(source, /完全なる市場平均/);
  assert.match(source, /無職という名の資本家/);
  assert.match(source, /2026最有力銘柄候補/);
  assert.match(source, /EVだけは億万長者/);
  assert.match(source, /静かなる資本家/);
  assert.doesNotMatch(source, /市場の怪物|再建待ったなし|成長余地あり|ぞろ目プレミア/);
  assert.match(source, /賢者・利回り最高/);
  assert.match(source, /カモ/);
  assert.match(source, /最高評価/);
  assert.doesNotMatch(source, /ストップ高/);
  assert.match(source, /上場廃止勧告・監理銘柄入り/);
  assert.match(source, /TOPIXに負けています/);
  assert.match(source, /市場平均を上回っています/);
  assert.match(source, /shareCardTheme/);
  assert.match(source, /1_000_000/);
  assert.match(source, /tone: "rainbow"/);
  assert.match(source, /tone: "purple"/);
  assert.match(source, /tone: "silver"/);
  assert.match(source, /tone: "green"/);
  assert.match(source, /最初からやり直す/);
});

test("all hidden titles have optimized avatar assets", async () => {
  const avatars = [
    "gekokujo.jpg",
    "high-education-working-poor.jpg",
    "treasure-wasted.jpg",
    "perfect-average.jpg",
    "unemployed-capitalist.jpg",
    "ai-2026-top-pick.jpg",
    "ev-millionaire.jpg",
    "quiet-capitalist.jpg",
  ];
  await Promise.all(avatars.map((name) => access(new URL(`../public/title-avatars/${name}`, import.meta.url))));
});
