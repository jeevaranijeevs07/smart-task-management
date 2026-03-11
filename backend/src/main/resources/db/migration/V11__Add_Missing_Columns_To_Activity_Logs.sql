-- ---------------------------------------------------------
-- Flyway Migration: V11__Add_Missing_Columns_To_Activity_Logs.sql
-- Description: Ensures card_id column exists in activity_logs.
-- ---------------------------------------------------------

-- We use a procedure to check if the column exists before adding it, 
-- as MySQL 8.0 doesn't support ADD COLUMN IF NOT EXISTS natively.

DELIMITER //

CREATE PROCEDURE AddCardIdToActivityLogs()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'smart_task_db' 
        AND TABLE_NAME = 'activity_logs' 
        AND COLUMN_NAME = 'card_id'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN card_id BIGINT AFTER workspace_id;
        ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_logs_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;
    END IF;
END //

DELIMITER ;

CALL AddCardIdToActivityLogs();

DROP PROCEDURE AddCardIdToActivityLogs;
