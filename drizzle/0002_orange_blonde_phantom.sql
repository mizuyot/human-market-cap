DROP INDEX `hmc_scores_occupation_score_idx`;--> statement-breakpoint
DROP INDEX `hmc_scores_age_score_idx`;--> statement-breakpoint
DROP INDEX `hmc_scores_education_score_idx`;--> statement-breakpoint
ALTER TABLE `hmc_scores` DROP COLUMN `occupation`;--> statement-breakpoint
ALTER TABLE `hmc_scores` DROP COLUMN `age`;--> statement-breakpoint
ALTER TABLE `hmc_scores` DROP COLUMN `education`;