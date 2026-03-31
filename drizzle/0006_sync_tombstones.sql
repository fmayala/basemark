ALTER TABLE `collections` ADD `updated_at` integer;
--> statement-breakpoint
UPDATE `collections`
SET `updated_at` = `created_at`
WHERE `updated_at` IS NULL;
--> statement-breakpoint
CREATE TABLE `tombstones` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `deleted_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tombstones_deleted_at_idx` ON `tombstones` (`deleted_at`);
--> statement-breakpoint
CREATE INDEX `tombstones_entity_type_entity_id_idx`
ON `tombstones` (`entity_type`, `entity_id`);
