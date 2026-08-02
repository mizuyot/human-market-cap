CREATE TABLE `hmc_score_history` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`score` integer NOT NULL,
	`quiz_correct` integer NOT NULL,
	`age` integer NOT NULL,
	`annual_income` integer NOT NULL,
	`education` text NOT NULL,
	`appearance` text NOT NULL,
	`occupation` text NOT NULL,
	`financial_assets` integer NOT NULL,
	`real_estate_assets` integer NOT NULL,
	`other_assets` integer NOT NULL,
	`reinvestment_rate` real NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hmc_score_history_uid_created_idx` ON `hmc_score_history` (`uid`,`created_at`);--> statement-breakpoint
CREATE INDEX `hmc_score_history_created_idx` ON `hmc_score_history` (`created_at`);