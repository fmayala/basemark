DROP TABLE IF EXISTS `api_tokens`;
--> statement-breakpoint
CREATE TABLE `api_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL,
  `token_prefix` text NOT NULL,
  `name` text NOT NULL,
  `scope` text NOT NULL,
  `expires_at` integer,
  `revoked_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);
