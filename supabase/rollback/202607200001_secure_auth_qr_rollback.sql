-- REVIEW ONLY. Do not execute automatically.
-- Reverses only objects introduced by 202607200001_secure_auth_migration.sql.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

drop policy if exists app_users_admin_write on public.app_users;
drop policy if exists app_users_read_self_or_admin on public.app_users;
drop function if exists public.consume_equipment_qr_rate_limit(char, integer, integer, integer);
drop function if exists public.consume_auth_login_rate_limit(char, integer, integer, integer);
drop function if exists public.current_user_is_app_admin();
drop function if exists public.create_equipment_qr_batch(jsonb,uuid);
drop function if exists public.bind_equipment_qr_label(uuid,uuid,text,uuid);
drop function if exists public.issue_equipment_qr_label(uuid,text,char,uuid,boolean);
drop function if exists public.create_equipment_and_bind_qr(uuid,jsonb,uuid);
drop function if exists public.rotate_equipment_qr_token(uuid,char,uuid);
drop function if exists public.revoke_equipment_qr_label(uuid,uuid);
drop table if exists public.equipment_qr_label_audit;
drop table if exists public.equipment_qr_labels;
drop table if exists public.equipment_qr_rate_limits;
drop table if exists public.auth_login_rate_limits;
drop type if exists public.equipment_qr_label_status;
drop index if exists public.app_users_auth_user_id_unique;
drop index if exists public.app_users_username_normalized_unique;
alter table public.app_users drop column if exists auth_user_id;

commit;
