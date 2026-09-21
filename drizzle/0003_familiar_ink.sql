CREATE TABLE `club_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`membership_validity_days` integer DEFAULT 30 NOT NULL,
	`expiry_reminder_days` integer DEFAULT 7 NOT NULL,
	`updated_at` text NOT NULL
);
