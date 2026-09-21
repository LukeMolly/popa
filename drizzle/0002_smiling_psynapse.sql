ALTER TABLE `members` ADD `id_number` text;--> statement-breakpoint
ALTER TABLE `members` ADD `date_of_birth` text;--> statement-breakpoint
ALTER TABLE `members` ADD `place_of_birth` text;--> statement-breakpoint
ALTER TABLE `members` ADD `membership_location` text;--> statement-breakpoint
ALTER TABLE `members` ADD `gender` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_id_number_unique` ON `members` (`id_number`);