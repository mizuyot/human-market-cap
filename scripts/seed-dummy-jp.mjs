/**
 * Seed ~50 ranking (+ history) rows with Japan-weighted demographics.
 * Usage: node --experimental-strip-types scripts/seed-dummy-jp.mjs --db human-market-cap-staging
 *        Defaults to staging DB to avoid accidentally seeding production.
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { calculateMarketCap } from "../app/server/calculation.ts";
import { getTier } from "../app/model.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "scripts", ".seed-dummy-jp.sql");
const argv = process.argv.slice(2);
const dbFlagIndex = argv.indexOf("--db");
const DB_NAME = dbFlagIndex >= 0
  ? argv[dbFlagIndex + 1]
  : (process.env.HMC_D1_NAME || "human-market-cap-staging");

if (!DB_NAME) {
  console.error("Missing database name. Pass --db <name>.");
  process.exit(1);
}
if (DB_NAME === "human-market-cap" && !argv.includes("--allow-production")) {
  console.error("Refusing to seed production without --allow-production.");
  process.exit(1);
}
console.log(`Seeding remote D1: ${DB_NAME}`);

/** @type {Array<Omit<import('../app/model.ts').ScoredCalculatorInputs, never>>} */
const profiles = [
  // 若年・入口層
  { age: 22, annualIncome: 220, education: "highSchool", appearance: "middle", occupation: "service", financialAssets: 20, realEstateAssets: 0, otherAssets: 0, reinvestmentRate: 0.05, correctAnswers: 0 },
  { age: 23, annualIncome: 200, education: "vocational", appearance: "top35", occupation: "beautician", financialAssets: 30, realEstateAssets: 0, otherAssets: 10, reinvestmentRate: 0.08, correctAnswers: 1 },
  { age: 24, annualIncome: 250, education: "university", appearance: "middle", occupation: "nonRegular", financialAssets: 40, realEstateAssets: 0, otherAssets: 0, reinvestmentRate: 0.1, correctAnswers: 1 },
  { age: 24, annualIncome: 280, education: "university", appearance: "middle", occupation: "childcare", financialAssets: 50, realEstateAssets: 0, otherAssets: 0, reinvestmentRate: 0.1, correctAnswers: 1 },
  { age: 25, annualIncome: 320, education: "university", appearance: "middle", occupation: "listedGeneral", financialAssets: 80, realEstateAssets: 0, otherAssets: 20, reinvestmentRate: 0.15, correctAnswers: 2 },
  { age: 26, annualIncome: 300, education: "vocational", appearance: "middle", occupation: "skilled", financialAssets: 100, realEstateAssets: 0, otherAssets: 30, reinvestmentRate: 0.12, correctAnswers: 1 },
  { age: 26, annualIncome: 270, education: "highSchool", appearance: "lower35", occupation: "service", financialAssets: 40, realEstateAssets: 0, otherAssets: 0, reinvestmentRate: 0.08, correctAnswers: 0 },
  { age: 27, annualIncome: 380, education: "march", appearance: "middle", occupation: "listedGeneral", financialAssets: 150, realEstateAssets: 0, otherAssets: 50, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 27, annualIncome: 350, education: "university", appearance: "middle", occupation: "nurse", financialAssets: 120, realEstateAssets: 0, otherAssets: 30, reinvestmentRate: 0.15, correctAnswers: 2 },
  { age: 28, annualIncome: 420, education: "university", appearance: "middle", occupation: "software", financialAssets: 200, realEstateAssets: 0, otherAssets: 50, reinvestmentRate: 0.25, correctAnswers: 3 },

  // 30代・ボリュームゾーン
  { age: 30, annualIncome: 450, education: "university", appearance: "middle", occupation: "listedGeneral", financialAssets: 300, realEstateAssets: 0, otherAssets: 50, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 30, annualIncome: 320, education: "highSchool", appearance: "middle", occupation: "skilled", financialAssets: 200, realEstateAssets: 0, otherAssets: 50, reinvestmentRate: 0.15, correctAnswers: 1 },
  { age: 31, annualIncome: 380, education: "vocational", appearance: "middle", occupation: "sme", financialAssets: 250, realEstateAssets: 0, otherAssets: 40, reinvestmentRate: 0.18, correctAnswers: 2 },
  { age: 32, annualIncome: 480, education: "march", appearance: "top35", occupation: "bankFinance", financialAssets: 400, realEstateAssets: 0, otherAssets: 80, reinvestmentRate: 0.25, correctAnswers: 3 },
  { age: 32, annualIncome: 360, education: "university", appearance: "middle", occupation: "teacher", financialAssets: 280, realEstateAssets: 0, otherAssets: 40, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 33, annualIncome: 340, education: "university", appearance: "middle", occupation: "public", financialAssets: 350, realEstateAssets: 0, otherAssets: 50, reinvestmentRate: 0.22, correctAnswers: 2 },
  { age: 33, annualIncome: 500, education: "upperUniversity", appearance: "middle", occupation: "software", financialAssets: 600, realEstateAssets: 0, otherAssets: 100, reinvestmentRate: 0.3, correctAnswers: 3 },
  { age: 34, annualIncome: 280, education: "highSchool", appearance: "middle", occupation: "service", financialAssets: 150, realEstateAssets: 0, otherAssets: 20, reinvestmentRate: 0.1, correctAnswers: 1 },
  { age: 34, annualIncome: 420, education: "university", appearance: "lower35", occupation: "sme", financialAssets: 400, realEstateAssets: 1500, otherAssets: 50, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 35, annualIncome: 550, education: "university", appearance: "middle", occupation: "listedGeneral", financialAssets: 700, realEstateAssets: 2000, otherAssets: 100, reinvestmentRate: 0.25, correctAnswers: 3 },
  { age: 35, annualIncome: 380, education: "vocational", appearance: "middle", occupation: "nurse", financialAssets: 450, realEstateAssets: 0, otherAssets: 80, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 36, annualIncome: 600, education: "sokeiBachelor", appearance: "middle", occupation: "consultant", financialAssets: 800, realEstateAssets: 0, otherAssets: 150, reinvestmentRate: 0.3, correctAnswers: 4 },
  { age: 36, annualIncome: 300, education: "university", appearance: "middle", occupation: "homemaker", financialAssets: 200, realEstateAssets: 2500, otherAssets: 50, reinvestmentRate: 0.15, correctAnswers: 1 },
  { age: 37, annualIncome: 450, education: "march", appearance: "middle", occupation: "productData", financialAssets: 900, realEstateAssets: 0, otherAssets: 120, reinvestmentRate: 0.28, correctAnswers: 3 },
  { age: 38, annualIncome: 520, education: "university", appearance: "middle", occupation: "listedManager", financialAssets: 1000, realEstateAssets: 2500, otherAssets: 150, reinvestmentRate: 0.25, correctAnswers: 3 },
  { age: 38, annualIncome: 340, education: "highSchool", appearance: "lower35", occupation: "skilled", financialAssets: 500, realEstateAssets: 1800, otherAssets: 80, reinvestmentRate: 0.15, correctAnswers: 1 },
  { age: 39, annualIncome: 700, education: "eliteBachelor", appearance: "middle", occupation: "doctor", financialAssets: 2000, realEstateAssets: 3000, otherAssets: 300, reinvestmentRate: 0.3, correctAnswers: 3 },
  { age: 39, annualIncome: 400, education: "university", appearance: "middle", occupation: "public", financialAssets: 800, realEstateAssets: 2200, otherAssets: 100, reinvestmentRate: 0.22, correctAnswers: 2 },

  // 40代・世帯形成後
  { age: 40, annualIncome: 580, education: "university", appearance: "middle", occupation: "listedGeneral", financialAssets: 1200, realEstateAssets: 2800, otherAssets: 150, reinvestmentRate: 0.25, correctAnswers: 3 },
  { age: 41, annualIncome: 450, education: "march", appearance: "middle", occupation: "sme", financialAssets: 900, realEstateAssets: 2500, otherAssets: 100, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 42, annualIncome: 480, education: "university", appearance: "middle", occupation: "teacher", financialAssets: 1100, realEstateAssets: 2400, otherAssets: 120, reinvestmentRate: 0.22, correctAnswers: 2 },
  { age: 42, annualIncome: 650, education: "upperUniversity", appearance: "middle", occupation: "bankFinance", financialAssets: 1800, realEstateAssets: 3500, otherAssets: 200, reinvestmentRate: 0.28, correctAnswers: 3 },
  { age: 43, annualIncome: 380, education: "vocational", appearance: "middle", occupation: "service", financialAssets: 600, realEstateAssets: 2000, otherAssets: 80, reinvestmentRate: 0.15, correctAnswers: 1 },
  { age: 44, annualIncome: 720, education: "eliteBachelor", appearance: "middle", occupation: "listedManager", financialAssets: 2200, realEstateAssets: 4000, otherAssets: 300, reinvestmentRate: 0.3, correctAnswers: 3 },
  { age: 45, annualIncome: 900, education: "tokyoKyotoBachelor", appearance: "middle", occupation: "doctor", financialAssets: 4000, realEstateAssets: 5000, otherAssets: 500, reinvestmentRate: 0.35, correctAnswers: 4 },
  { age: 45, annualIncome: 400, education: "university", appearance: "lower35", occupation: "public", financialAssets: 1500, realEstateAssets: 3000, otherAssets: 150, reinvestmentRate: 0.25, correctAnswers: 2 },
  { age: 46, annualIncome: 350, education: "highSchool", appearance: "middle", occupation: "businessOwner", financialAssets: 800, realEstateAssets: 3500, otherAssets: 200, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 47, annualIncome: 550, education: "university", appearance: "middle", occupation: "accountant", financialAssets: 2000, realEstateAssets: 3200, otherAssets: 250, reinvestmentRate: 0.28, correctAnswers: 3 },
  { age: 48, annualIncome: 420, education: "university", appearance: "middle", occupation: "sme", financialAssets: 1300, realEstateAssets: 2800, otherAssets: 150, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 49, annualIncome: 480, education: "march", appearance: "middle", occupation: "medicalSpecialist", financialAssets: 1600, realEstateAssets: 3000, otherAssets: 200, reinvestmentRate: 0.25, correctAnswers: 3 },

  // 50代〜・後半
  { age: 50, annualIncome: 620, education: "university", appearance: "middle", occupation: "listedManager", financialAssets: 2500, realEstateAssets: 3500, otherAssets: 300, reinvestmentRate: 0.28, correctAnswers: 3 },
  { age: 52, annualIncome: 450, education: "university", appearance: "lower35", occupation: "public", financialAssets: 2800, realEstateAssets: 3200, otherAssets: 250, reinvestmentRate: 0.25, correctAnswers: 2 },
  { age: 53, annualIncome: 380, education: "highSchool", appearance: "middle", occupation: "skilled", financialAssets: 1500, realEstateAssets: 2500, otherAssets: 150, reinvestmentRate: 0.18, correctAnswers: 1 },
  { age: 55, annualIncome: 500, education: "university", appearance: "middle", occupation: "listedGeneral", financialAssets: 3000, realEstateAssets: 3000, otherAssets: 300, reinvestmentRate: 0.25, correctAnswers: 2 },
  { age: 56, annualIncome: 320, education: "vocational", appearance: "middle", occupation: "nurse", financialAssets: 1800, realEstateAssets: 2200, otherAssets: 150, reinvestmentRate: 0.2, correctAnswers: 2 },
  { age: 58, annualIncome: 280, education: "university", appearance: "middle", occupation: "homemaker", financialAssets: 1200, realEstateAssets: 2800, otherAssets: 100, reinvestmentRate: 0.15, correctAnswers: 1 },
  { age: 60, annualIncome: 350, education: "university", appearance: "middle", occupation: "public", financialAssets: 3500, realEstateAssets: 2500, otherAssets: 200, reinvestmentRate: 0.2, correctAnswers: 2 },

  // 少数の低位・高位（現実の裾野）
  { age: 29, annualIncome: 0, education: "university", appearance: "middle", occupation: "unemployed", financialAssets: 80, realEstateAssets: 0, otherAssets: 0, reinvestmentRate: 0, correctAnswers: 0 },
  { age: 41, annualIncome: 180, education: "highSchool", appearance: "lower10", occupation: "nonRegular", financialAssets: 50, realEstateAssets: 0, otherAssets: 10, reinvestmentRate: 0.05, correctAnswers: 0 },
  { age: 44, annualIncome: 1100, education: "sokeiGraduate", appearance: "middle", occupation: "investmentBank", financialAssets: 5000, realEstateAssets: 6000, otherAssets: 800, reinvestmentRate: 0.4, correctAnswers: 5 },
];

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const now = Date.now();
const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
const statements = [];

profiles.forEach((profile, index) => {
  const calc = calculateMarketCap(profile);
  const scoreYen = Math.round(calc.marketCapMan * 10_000);
  const tier = getTier(calc.marketCapMan);
  tierCounts[tier] += 1;
  const id = randomUUID();
  const historyId = randomUUID();
  const uid = `dummy-jp-${String(index + 1).padStart(2, "0")}-${randomUUID().slice(0, 8)}`;
  const updatedAt = now - (profiles.length - index) * 60_000;

  statements.push(`INSERT INTO hmc_scores (id, uid, score, updated_at) VALUES (${sqlString(id)}, ${sqlString(uid)}, ${scoreYen}, ${updatedAt});`);
  statements.push(`INSERT INTO hmc_score_history (
    id, uid, score, quiz_correct, age, annual_income, education, appearance, occupation,
    financial_assets, real_estate_assets, other_assets, reinvestment_rate, created_at
  ) VALUES (
    ${sqlString(historyId)}, ${sqlString(uid)}, ${scoreYen}, ${profile.correctAnswers},
    ${profile.age}, ${Math.round(profile.annualIncome)}, ${sqlString(profile.education)},
    ${sqlString(profile.appearance)}, ${sqlString(profile.occupation)},
    ${Math.round(profile.financialAssets)}, ${Math.round(profile.realEstateAssets)},
    ${Math.round(profile.otherAssets)}, ${profile.reinvestmentRate}, ${updatedAt}
  );`);
});

writeFileSync(sqlPath, statements.join("\n") + "\n", "utf8");
console.log(`Prepared ${profiles.length} dummy profiles.`);
console.log("Tier mix:", tierCounts);

const apply = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", DB_NAME, "--remote", `--file=${sqlPath}`],
  { cwd: root, encoding: "utf8", env: process.env },
);
process.stdout.write(apply.stdout ?? "");
process.stderr.write(apply.stderr ?? "");
try {
  unlinkSync(sqlPath);
} catch {
  // keep file if unlink fails; still surface wrangler status
}
if (apply.status !== 0) process.exit(apply.status ?? 1);

const check = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", DB_NAME, "--remote", "--command",
    "SELECT COUNT(*) AS scores FROM hmc_scores; SELECT COUNT(*) AS history FROM hmc_score_history; SELECT COUNT(*) AS dummies FROM hmc_scores WHERE uid LIKE 'dummy-jp-%';"],
  { cwd: root, encoding: "utf8", env: process.env },
);
process.stdout.write(check.stdout ?? "");
process.stderr.write(check.stderr ?? "");
if (check.status !== 0) process.exit(check.status ?? 1);
console.log("Dummy seed finished.");
