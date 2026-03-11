ALTER TABLE card_attachments
    ADD COLUMN user_id BIGINT NULL AFTER card_id;

ALTER TABLE card_attachments
    ADD CONSTRAINT fk_card_attachments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL;
