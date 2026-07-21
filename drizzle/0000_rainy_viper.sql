CREATE TABLE `hmc_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`question_ids` text NOT NULL,
	`answers_json` text,
	`correct_count` integer,
	`uid` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `hmc_quiz_attempts_expires_idx` ON `hmc_quiz_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `hmc_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hmc_rate_limits_expires_idx` ON `hmc_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `hmc_scores` (
	`uid` text PRIMARY KEY NOT NULL,
	`score` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hmc_scores_score_idx` ON `hmc_scores` (`score`);