CREATE TABLE `admin_login_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_admin_sessions_token` ON `admin_sessions` (`token_hash`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `pin_salt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `pin_hash` text DEFAULT '' NOT NULL;