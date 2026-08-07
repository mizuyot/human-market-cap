import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);

test("mobile viewport and safe-area support are configured", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("app/layout.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);

  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*100dvh/);
});

test("small screens keep controls readable and responsive", async () => {
  const css = await readFile(new URL("app/globals.css", appRoot), "utf8");

  assert.match(css, /select\s*\{[\s\S]*?font-size:\s*16px|\.select-wrap select, select \{[\s\S]*?font-size:\s*16px/);
  assert.match(css, /\.choice-grid label \{[\s\S]*?min-height:\s*54px/);
  assert.match(css, /@media \(max-width:\s*420px\)/);
  assert.match(css, /@media \(max-width:\s*340px\)/);
  assert.match(css, /\.chart-scroll\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.asset-column\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(css, /valuation-layout/);
  assert.match(css, /wizard-actions-mobile/);
});

test("body copy and captions stay at least 11px", async () => {
  const css = await readFile(new URL("app/globals.css", appRoot), "utf8");
  const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
  assert.ok(sizes.length > 0);
  assert.ok(sizes.every((size) => size >= 11), `found sub-11px sizes: ${sizes.filter((size) => size < 11).join(", ")}`);

  const shorthand = [...css.matchAll(/font:\s*(?:(?:inherit|italic|normal|[0-9]{3})\s+)*([0-9.]+)px/g)]
    .map((match) => Number(match[1]));
  assert.ok(
    shorthand.every((size) => size >= 11),
    `found sub-11px font shorthand sizes: ${shorthand.filter((size) => size < 11).join(", ")}`,
  );
});

test("quiz questions allow twenty seconds each", async () => {
  const source = await readFile(new URL("app/HumanMarketCapApp.tsx", appRoot), "utf8");
  assert.match(source, /const QUIZ_SECONDS = 20/);
  assert.match(source, /A\/B 各20秒/);
});

test("lifetime charts use a compact set of representative ages", async () => {
  const source = await readFile(new URL("app/HumanMarketCapApp.tsx", appRoot), "utf8");

  assert.match(source, /compactProjections\(data: AnnualProjection\[\], maxPoints = 6\)/);
  assert.doesNotMatch(source, /92 \+ data\.length \* 68/);
  assert.match(source, /代表年齢を表示/);
});
