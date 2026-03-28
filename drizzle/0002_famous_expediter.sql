CREATE TABLE `document_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `is_public` integer DEFAULT false NOT NULL;