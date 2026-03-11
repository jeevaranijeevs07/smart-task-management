SET @action_token_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME = 'action_token'
);

SET @ddl = IF(
    @action_token_exists = 0,
    'ALTER TABLE notifications ADD COLUMN action_token VARCHAR(255) NULL AFTER type',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
