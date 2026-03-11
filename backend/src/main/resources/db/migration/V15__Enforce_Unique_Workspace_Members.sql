-- Enforce uniqueness for workspace members across historical databases.
-- Some early schemas created workspace_members without a unique key, and later
-- CREATE TABLE IF NOT EXISTS migrations did not retrofit the constraint.

-- 1) Remove duplicates (keep the smallest id per (workspace_id, user_id)).
DELETE wm1
FROM workspace_members wm1
JOIN workspace_members wm2
  ON wm1.workspace_id = wm2.workspace_id
 AND wm1.user_id = wm2.user_id
 AND wm1.id > wm2.id;

-- 2) Add unique key if it does not exist.
SET @idx := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'workspace_members'
    AND index_name = 'unique_workspace_member'
);

SET @sql := IF(
  @idx = 0,
  'ALTER TABLE workspace_members ADD UNIQUE KEY unique_workspace_member (workspace_id, user_id)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

