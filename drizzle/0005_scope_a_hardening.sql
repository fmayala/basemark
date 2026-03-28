ALTER TABLE `api_tokens` RENAME TO `api_tokens_legacy`;
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
INSERT INTO `api_tokens` (
  `id`,
  `token_hash`,
  `token_prefix`,
  `name`,
  `scope`,
  `expires_at`,
  `revoked_at`,
  `created_at`,
  `last_used_at`
)
SELECT
  `id`,
  lower(hex(randomblob(32))) AS `token_hash`,
  CASE
    WHEN length(`token`) <= 11 THEN `token`
    ELSE substr(`token`, 1, 11) || '...'
  END AS `token_prefix`,
  `name`,
  'mcp:access docs:read docs:write' AS `scope`,
  NULL AS `expires_at`,
  CAST(strftime('%s', 'now') AS integer) AS `revoked_at`,
  `created_at`,
  `last_used_at`
FROM `api_tokens_legacy`;
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);
--> statement-breakpoint
DROP TABLE `api_tokens_legacy`;
