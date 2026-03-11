-- ---------------------------------------------------------
-- Flyway Migration: V4__Add_Avatar_To_Users.sql
-- Add avatar URL support for user profile
-- ---------------------------------------------------------

ALTER TABLE users
ADD COLUMN avatar_url VARCHAR(512) NULL;
