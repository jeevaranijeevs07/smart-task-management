CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    card_id BIGINT NULL,
    message TEXT NOT NULL,
    type ENUM('CARD_ASSIGNED', 'DUE_REMINDER', 'LIST_CHANGED', 'WORKSPACE_INVITATION') NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL
);

-- Drop and recreate indexes
ALTER TABLE notifications DROP INDEX idx_notifications_user_created_at;
CREATE INDEX idx_notifications_user_created_at 
ON notifications (user_id, created_at);

ALTER TABLE notifications DROP INDEX idx_notifications_user_is_read;
CREATE INDEX idx_notifications_user_is_read 
ON notifications (user_id, is_read);