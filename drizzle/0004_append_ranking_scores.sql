CREATE TABLE `hmc_scores_new` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`score` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `hmc_scores_new` (`id`, `uid`, `score`, `updated_at`)
SELECT lower(hex(randomblob(16))), `uid`, `score`, `updated_at` FROM `hmc_scores`;--> statement-breakpoint
DROP TABLE `hmc_scores`;--> statement-breakpoint
ALTER TABLE `hmc_scores_new` RENAME TO `hmc_scores`;--> statement-breakpoint
CREATE INDEX `hmc_scores_score_idx` ON `hmc_scores` (`score`);--> statement-breakpoint
CREATE INDEX `hmc_scores_uid_idx` ON `hmc_scores` (`uid`);
