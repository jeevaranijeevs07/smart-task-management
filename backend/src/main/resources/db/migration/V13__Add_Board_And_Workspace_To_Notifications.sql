ALTER TABLE notifications
    ADD COLUMN workspace_id BIGINT NULL,
    ADD COLUMN board_id BIGINT NULL,
    ADD CONSTRAINT fk_notifications_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_notifications_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;
