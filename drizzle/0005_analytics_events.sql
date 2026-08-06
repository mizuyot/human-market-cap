CREATE TABLE `hmc_analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`session_id` text NOT NULL,
	`uid` text,
	`path` text NOT NULL,
	`referrer` text NOT NULL,
	`props_json` text NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `hmc_analytics_events_name_created_idx` ON `hmc_analytics_events` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `hmc_analytics_events_created_idx` ON `hmc_analytics_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `hmc_analytics_events_session_idx` ON `hmc_analytics_events` (`session_id`);
