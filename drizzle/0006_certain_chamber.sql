CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`squad_number` integer NOT NULL,
	`position` text NOT NULL,
	`contract_type` text DEFAULT 'Permanent' NOT NULL,
	`contract_start` text DEFAULT '' NOT NULL,
	`contract_end` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`lineup_role` text DEFAULT 'squad' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_squad_number` ON `players` (`squad_number`);