-- ---------------------------------------------------------
-- Flyway Migration: V10__Activity_Logs_Table.sql
-- Description: Creates the activity_logs table for tracking user actions.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT,
    card_id BIGINT,
    user_id BIGINT NOT NULL,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
