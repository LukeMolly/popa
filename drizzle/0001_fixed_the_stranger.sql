CREATE TABLE `club_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`opponent` text NOT NULL,
	`kickoff` text NOT NULL,
	`venue` text NOT NULL,
	`home_away` text NOT NULL,
	`competition` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`rollers_score` integer,
	`opponent_score` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`amount` integer DEFAULT 200 NOT NULL,
	`receipt_key` text NOT NULL,
	`receipt_name` text NOT NULL,
	`receipt_type` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `standings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team` text NOT NULL,
	`played` integer DEFAULT 0 NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`drawn` integer DEFAULT 0 NOT NULL,
	`lost` integer DEFAULT 0 NOT NULL,
	`goal_difference` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standings_team_unique` ON `standings` (`team`);