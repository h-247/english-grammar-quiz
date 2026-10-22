CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `banner_url` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `courses_deleted_at_idx` ON `courses` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `courses_user_id_idx` ON `courses` (`user_id`);--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `attempts_user_id_idx` ON `quiz_attempts` (`user_id`);--> statement-breakpoint
ALTER TABLE `quizzes` ADD `chatgpt_url` text;