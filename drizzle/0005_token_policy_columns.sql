ALTER TABLE `api_tokens` RENAME COLUMN `token` TO `token_hash`;
--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `scope` text DEFAULT 'documents:read' NOT NULL;
--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `api_tokens` ADD `expires_at` integer;
--> statement-breakpoint
DROP INDEX IF EXISTS `api_tokens_token_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);
