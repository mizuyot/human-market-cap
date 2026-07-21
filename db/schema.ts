import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scores = sqliteTable("hmc_scores", {
  uid: text("uid").primaryKey(),
  score: integer("score").notNull(),
  occupation: text("occupation"),
  age: integer("age"),
  education: text("education"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("hmc_scores_score_idx").on(table.score),
  index("hmc_scores_occupation_score_idx").on(table.occupation, table.score),
  index("hmc_scores_age_score_idx").on(table.age, table.score),
  index("hmc_scores_education_score_idx").on(table.education, table.score),
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
