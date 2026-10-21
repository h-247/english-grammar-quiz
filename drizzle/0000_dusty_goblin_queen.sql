CREATE TABLE `attempt_results` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`total_questions` integer NOT NULL,
	`total_blanks` integer NOT NULL,
	`correct_blanks` integer NOT NULL,
	`incorrect_blanks` integer NOT NULL,
	`unanswered_blanks` integer NOT NULL,
	`fully_correct_questions` integer NOT NULL,
	`accuracy_percentage` real NOT NULL,
	`time_spent_seconds` integer NOT NULL,
	`submission_reason` text NOT NULL,
	`detailed_results` text NOT NULL,
	`finalized_at` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_results_attempt_id_unique` ON `attempt_results` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `results_attempt_id_idx` ON `attempt_results` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `blanks` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`blank_identifier` text NOT NULL,
	`order_index` integer NOT NULL,
	`accepted_answers` text NOT NULL,
	`source_question_id` text,
	`objective_id` text,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blanks_question_id_idx` ON `blanks` (`question_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`drive_folder_id` text,
	`drive_folder_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `courses_drive_folder_id_idx` ON `courses` (`drive_folder_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`external_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`topic` text NOT NULL,
	`section` text,
	`question_type` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`blank_count` integer NOT NULL,
	`objective_ids` text,
	`explanation` text,
	`difficulty` text,
	`source_pdf_page` integer,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_quiz_id_idx` ON `questions` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `questions_order_idx` ON `questions` (`order_index`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`started_at` text NOT NULL,
	`deadline_at` text NOT NULL,
	`submitted_at` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`submission_reason` text,
	`mode` text DEFAULT 'timed' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_quiz_id_idx` ON `quiz_attempts` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `attempts_status_idx` ON `quiz_attempts` (`status`);--> statement-breakpoint
CREATE INDEX `attempts_deadline_idx` ON `quiz_attempts` (`deadline_at`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`schema_version` text DEFAULT '2.0.0' NOT NULL,
	`quiz_type` text DEFAULT 'multi_blank_fill_in_the_blank' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`title` text NOT NULL,
	`unit_number` integer,
	`unit_title` text,
	`instructions` text,
	`placeholder_syntax` text DEFAULT '{{n}}' NOT NULL,
	`grading_config` text,
	`topics` text,
	`learning_objectives` text,
	`coverage_audit` text,
	`question_count` integer DEFAULT 0 NOT NULL,
	`blank_count` integer DEFAULT 0 NOT NULL,
	`course_id` text,
	`drive_file_id` text,
	`source_filename` text,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_content_hash_idx` ON `quizzes` (`content_hash`);--> statement-breakpoint
CREATE INDEX `quizzes_course_id_idx` ON `quizzes` (`course_id`);--> statement-breakpoint
CREATE INDEX `quizzes_unit_number_idx` ON `quizzes` (`unit_number`);--> statement-breakpoint
CREATE TABLE `user_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`blank_identifier` text NOT NULL,
	`response_text` text DEFAULT '' NOT NULL,
	`is_correct` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attempt_question_blank` ON `user_responses` (`attempt_id`,`question_id`,`blank_identifier`);--> statement-breakpoint
CREATE INDEX `responses_attempt_id_idx` ON `user_responses` (`attempt_id`);