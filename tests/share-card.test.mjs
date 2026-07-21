import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(source, /賢者・利回りMAX/);
  assert.match(source, /カモ/);
  assert.match(source, /ストップ高/);
  assert.match(source, /上場廃止勧告・監理銘柄入り/);
  assert.match(source, /TOPIXに負けています/);
});
