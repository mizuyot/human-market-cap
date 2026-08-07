import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("public HMC page uses only Noto Sans JP gothic stack", () => {
  const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  const app = readFileSync(join(root, "app/HumanMarketCapApp.tsx"), "utf8");

  assert.match(layout, /Noto_Sans_JP/);
  assert.match(layout, /weight:\s*\[["']400["'],\s*["']500["'],\s*["']600["'],\s*["']700["'],\s*["']800["']\]/);
  assert.doesNotMatch(layout, /Noto_Serif_JP|DM_Mono/);

  assert.match(css, /--type-gothic:/);
  assert.match(css, /\.hmc-app,\s*\n\.hmc-app \*/);
  assert.doesNotMatch(css, /Noto Serif JP|DM Mono|--type-display|--type-data|--serif:|--mono:/);
  assert.doesNotMatch(css, /var\(--serif\)|var\(--mono\)/);

  assert.match(app, /className="hmc-app"/);
  assert.match(app, /hero-title-line/);
  assert.doesNotMatch(app, /Noto Serif JP|DM Mono/);
});
