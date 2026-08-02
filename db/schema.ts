import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scores = sqliteTable("hmc_scores", {
  uid: text("uid").primaryKey(),
  score: integer("score").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("hmc_scores_score_idx").on(table.score),
]);

/** Append-only valuation history with input snapshot. Ranking still uses hmc_scores. */
export const scoreHistory = sqliteTable("hmc_score_history", {
  id: text("id").primaryKey(),
  uid: text("uid").notNull(),
  score: integer("score").notNull(),
  quizCorrect: integer("quiz_correct").notNull(),
  age: integer("age").notNull(),
  annualIncome: integer("annual_income").notNull(),
  education: text("education").notNull(),
  appearance: text("appearance").notNull(),
  occupation: text("occupation").notNull(),
  financialAssets: integer("financial_assets").notNull(),
  realEstateAssets: integer("real_estate_assets").notNull(),
  otherAssets: integer("other_assets").notNull(),
  reinvestmentRate: real("reinvestment_rate").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("hmc_score_history_uid_created_idx").on(table.uid, table.createdAt),
  index("hmc_score_history_created_idx").on(table.createdAt),
]);

export const quizAttempts = sqliteTable("hmc_quiz_attempts", {
  id: text("id").primaryKey(),
  questionIds: text("question_ids").notNull(),
  answersJson: text("answers_json"),
  correctCount: integer("correct_count"),
  uid: text("uid"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  completedAt: integer("completed_at"),
}, (table) => [index("hmc_quiz_attempts_expires_idx").on(table.expiresAt)]);

export const rateLimits = sqliteTable("hmc_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("hmc_rate_limits_expires_idx").on(table.expiresAt)]);
