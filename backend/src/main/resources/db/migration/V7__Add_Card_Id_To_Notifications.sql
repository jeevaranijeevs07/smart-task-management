SET @card_id_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME = 'card_id'
);

SET @ddl = IF(
    @card_id_exists = 0,
    'ALTER TABLE notifications ADD COLUMN card_id BIGINT NULL AFTER user_id',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
