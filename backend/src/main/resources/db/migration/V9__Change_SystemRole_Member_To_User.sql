-- ---------------------------------------------------------
-- Flyway Migration: V9__Change_SystemRole_Member_To_User.sql
-- Description: Renames the default SystemRole from 'MEMBER' to 'USER' for clarity and consistency.
-- ---------------------------------------------------------

UPDATE users 
SET system_role = 'USER' 
WHERE system_role = 'MEMBER';
