UPDATE `document_permissions`
SET `email` = lower(trim(`email`));
--> statement-breakpoint
DELETE FROM `document_permissions`
WHERE `rowid` IN (
  SELECT `rowid`
  FROM (
    SELECT
      `rowid`,
      row_number() OVER (
        PARTITION BY `document_id`, `email`
        ORDER BY `created_at` DESC, `rowid` DESC
      ) AS `rn`
    FROM `document_permissions`
  )
  WHERE `rn` > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_permissions_document_id_email_unique`
ON `document_permissions` (`document_id`,`email`);
