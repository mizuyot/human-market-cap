ALTER TABLE `hmc_scores` ADD `occupation` text;--> statement-breakpoint
ALTER TABLE `hmc_scores` ADD `age` integer;--> statement-breakpoint
ALTER TABLE `hmc_scores` ADD `education` text;--> statement-breakpoint
CREATE INDEX `hmc_scores_occupation_score_idx` ON `hmc_scores` (`occupation`,`score`);--> statement-breakpoint
CREATE INDEX `hmc_scores_age_score_idx` ON `hmc_scores` (`age`,`score`);--> statement-breakpoint
CREATE INDEX `hmc_scores_education_score_idx` ON `hmc_scores` (`education`,`score`);