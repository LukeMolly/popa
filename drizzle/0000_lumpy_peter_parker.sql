CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text DEFAULT '' NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_token` ON `members` (`token`);--> statement-breakpoint
CREATE TABLE `promos` (
	`code` text PRIMARY KEY NOT NULL,
	`campaign` text NOT NULL,
	`member_id` text,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
