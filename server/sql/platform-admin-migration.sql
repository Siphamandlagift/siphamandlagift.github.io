-- Platform admin migration
-- Run this after billing-migration.sql

alter table users add column if not exists is_platform_admin boolean not null default false;

-- To make yourself platform admin, run:
--   update users set is_platform_admin = true where email = 'your@email.com';
