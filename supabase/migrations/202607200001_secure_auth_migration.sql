-- Additive, transactional migration. Never reset or seed the target database.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('helpdesk-secure-auth-qr-v1', 0));

select set_config('helpdesk.pre_app_users',(select count(*)::text from public.app_users),true);
select set_config('helpdesk.pre_equipamentos',(select count(*)::text from public.equipamentos),true);
select set_config('helpdesk.pre_chamados',(select count(*)::text from public.chamados),true);

do $$
begin
  if exists (
    select 1 from public.app_users
    group by lower(btrim(username)) having count(*) > 1
  ) then raise exception 'duplicate normalized username'; end if;
  if exists (select 1 from public.app_users where username is null or btrim(username) = '') then
    raise exception 'invalid username';
  end if;
end $$;

alter table public.app_users
  add column if not exists auth_user_id uuid null references auth.users(id) on delete set null;

create unique index if not exists app_users_auth_user_id_unique
  on public.app_users(auth_user_id) where auth_user_id is not null;
create unique index if not exists app_users_username_normalized_unique
  on public.app_users(lower(btrim(username)));

create table if not exists public.auth_login_rate_limits (
  key_hash char(64) primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.equipment_qr_rate_limits (
  key_hash char(64) primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

create or replace function public.consume_auth_login_rate_limit(
  p_key_hash char(64), p_max_attempts integer default 5,
  p_window_seconds integer default 900, p_block_seconds integer default 900
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_row public.auth_login_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_max_attempts not between 1 and 100
    or p_window_seconds not between 1 and 86400 or p_block_seconds not between 1 and 86400
  then raise exception 'invalid rate-limit input'; end if;
  insert into public.auth_login_rate_limits(key_hash, window_started_at, attempts, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update set
    window_started_at = case when auth_login_rate_limits.window_started_at <= v_now-make_interval(secs=>p_window_seconds) then v_now else auth_login_rate_limits.window_started_at end,
    attempts = case when auth_login_rate_limits.window_started_at <= v_now-make_interval(secs=>p_window_seconds) then 1 else auth_login_rate_limits.attempts+1 end,
    blocked_until = case when auth_login_rate_limits.blocked_until > v_now then auth_login_rate_limits.blocked_until when auth_login_rate_limits.window_started_at > v_now-make_interval(secs=>p_window_seconds) and auth_login_rate_limits.attempts+1 > p_max_attempts then v_now+make_interval(secs=>p_block_seconds) else null end,
    updated_at=v_now returning * into v_row;
  allowed := v_row.blocked_until is null or v_row.blocked_until <= v_now;
  retry_after_seconds := case when allowed then 0 else greatest(1,ceil(extract(epoch from(v_row.blocked_until-v_now)))::integer) end;
  return next;
end $$;

create or replace function public.consume_equipment_qr_rate_limit(
  p_key_hash char(64), p_max_attempts integer default 60,
  p_window_seconds integer default 60, p_block_seconds integer default 60
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_row public.equipment_qr_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_max_attempts not between 1 and 1000
    or p_window_seconds not between 1 and 86400 or p_block_seconds not between 1 and 86400
  then raise exception 'invalid rate-limit input'; end if;
  insert into public.equipment_qr_rate_limits(key_hash,window_started_at,attempts,updated_at) values(p_key_hash,v_now,1,v_now)
  on conflict(key_hash) do update set
    window_started_at=case when equipment_qr_rate_limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then v_now else equipment_qr_rate_limits.window_started_at end,
    attempts=case when equipment_qr_rate_limits.window_started_at<=v_now-make_interval(secs=>p_window_seconds) then 1 else equipment_qr_rate_limits.attempts+1 end,
    blocked_until=case when equipment_qr_rate_limits.blocked_until>v_now then equipment_qr_rate_limits.blocked_until when equipment_qr_rate_limits.window_started_at>v_now-make_interval(secs=>p_window_seconds) and equipment_qr_rate_limits.attempts+1>p_max_attempts then v_now+make_interval(secs=>p_block_seconds) else null end,
    updated_at=v_now returning * into v_row;
  allowed:=v_row.blocked_until is null or v_row.blocked_until<=v_now;
  retry_after_seconds:=case when allowed then 0 else greatest(1,ceil(extract(epoch from(v_row.blocked_until-v_now)))::integer) end;
  return next;
end $$;

do $$ begin create type public.equipment_qr_label_status as enum ('UNUSED','BOUND','REVOKED','VOID'); exception when duplicate_object then null; end $$;
create table if not exists public.equipment_qr_labels (
  id uuid primary key default gen_random_uuid(), display_code varchar(24) not null unique check(display_code~'^[A-Z0-9]+(-[A-Z0-9]+)?$'),
  token_hash char(64) not null unique check(token_hash~'^[0-9a-f]{64}$'), status public.equipment_qr_label_status not null default 'UNUSED',
  equipment_id uuid references public.equipamentos(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  bound_at timestamptz, bound_by_user_id uuid references public.app_users(id) on delete restrict, revoked_at timestamptz,
  revoked_by_user_id uuid references public.app_users(id) on delete restrict,
  check((status='BOUND' and equipment_id is not null and bound_at is not null and bound_by_user_id is not null) or status<>'BOUND'),
  check((status='REVOKED' and revoked_at is not null and revoked_by_user_id is not null) or status<>'REVOKED')
);
create unique index if not exists equipment_qr_labels_one_active_per_equipment on public.equipment_qr_labels(equipment_id) where equipment_id is not null and status='BOUND';
create table if not exists public.equipment_qr_label_audit (
  id uuid primary key default gen_random_uuid(), label_id uuid not null references public.equipment_qr_labels(id) on delete restrict,
  action varchar(24) not null check(action in ('GENERATED','BOUND','REVOKED','REISSUED','VOIDED','REPRINTED')),
  actor_user_id uuid references public.app_users(id) on delete restrict, equipment_id uuid references public.equipamentos(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists equipment_qr_label_audit_label_created on public.equipment_qr_label_audit(label_id,created_at desc);

create or replace function public.create_equipment_qr_batch(p_items jsonb,p_actor_user_id uuid)
returns table(id uuid,display_code varchar,status public.equipment_qr_label_status,equipment_id uuid,created_at timestamptz,updated_at timestamptz,bound_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare item jsonb; made public.equipment_qr_labels%rowtype;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'invalid batch'; end if;
  if not exists(select 1 from public.app_users where app_users.id=p_actor_user_id and tier='admin') then raise exception 'unauthorized'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(item->>'display_code','')!~'^[A-Z0-9]+(-[A-Z0-9]+)?$' or coalesce(item->>'token_hash','')!~'^[0-9a-f]{64}$' then raise exception 'invalid label'; end if;
    insert into public.equipment_qr_labels(display_code,token_hash) values(item->>'display_code',item->>'token_hash') returning * into made;
    insert into public.equipment_qr_label_audit(label_id,action,actor_user_id) values(made.id,'GENERATED',p_actor_user_id);
    id:=made.id;display_code:=made.display_code;status:=made.status;equipment_id:=made.equipment_id;created_at:=made.created_at;updated_at:=made.updated_at;bound_at:=made.bound_at;revoked_at:=made.revoked_at;return next;
  end loop;
end $$;

create or replace function public.bind_equipment_qr_label(p_label_id uuid,p_equipment_id uuid,p_decision text,p_actor_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare code text; current_patrimony text;
begin
  if p_decision not in ('KEEP','REPLACE','FILL') or not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'invalid input'; end if;
  select display_code into code from public.equipment_qr_labels where id=p_label_id and status='UNUSED' for update;
  select patrimonio into current_patrimony from public.equipamentos where id=p_equipment_id for update;
  if code is null or not exists(select 1 from public.equipamentos where id=p_equipment_id) then raise exception 'not found'; end if;
  if p_decision='REPLACE' or (p_decision='FILL' and coalesce(current_patrimony,'')='') then update public.equipamentos set patrimonio=code where id=p_equipment_id; end if;
  update public.equipment_qr_labels set status='BOUND',equipment_id=p_equipment_id,bound_at=now(),bound_by_user_id=p_actor_user_id,updated_at=now() where id=p_label_id and status='UNUSED';
  if not found then raise exception 'conflict'; end if;
  insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'BOUND',p_actor_user_id,p_equipment_id);
  return true;
end $$;

alter table public.auth_login_rate_limits enable row level security;
alter table public.equipment_qr_rate_limits enable row level security;
alter table public.equipment_qr_labels enable row level security;
alter table public.equipment_qr_label_audit enable row level security;
alter table public.app_users enable row level security;
revoke all on public.auth_login_rate_limits,public.equipment_qr_rate_limits,public.equipment_qr_labels,public.equipment_qr_label_audit from public,anon,authenticated;
revoke all on public.app_users from anon, authenticated;
grant select (id,username,name,setor,cargo,tier,is_admin,created_at,auth_user_id) on public.app_users to authenticated;
grant insert (username,name,setor,cargo,password_hash,tier), update (username,name,setor,cargo,password_hash,tier), delete on public.app_users to authenticated;

create or replace function public.current_user_is_app_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.app_users where auth_user_id=auth.uid() and tier='admin') $$;
revoke all on function public.current_user_is_app_admin() from public,anon;
grant execute on function public.current_user_is_app_admin() to authenticated,service_role;
revoke all on function public.consume_auth_login_rate_limit(char,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.consume_equipment_qr_rate_limit(char,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.create_equipment_qr_batch(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.bind_equipment_qr_label(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.consume_auth_login_rate_limit(char,integer,integer,integer) to service_role;
grant execute on function public.consume_equipment_qr_rate_limit(char,integer,integer,integer) to service_role;
grant execute on function public.create_equipment_qr_batch(jsonb,uuid) to service_role;
grant execute on function public.bind_equipment_qr_label(uuid,uuid,text,uuid) to service_role;

do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='app_users' and policyname='app_users_read_self_or_admin') then
  create policy app_users_read_self_or_admin on public.app_users for select to authenticated using(auth_user_id=auth.uid() or public.current_user_is_app_admin());
end if; end $$;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='app_users' and policyname='app_users_admin_write') then
  create policy app_users_admin_write on public.app_users for all to authenticated using(public.current_user_is_app_admin()) with check(public.current_user_is_app_admin());
end if; end $$;

do $$ begin
  if current_setting('helpdesk.pre_app_users')::bigint<>(select count(*) from public.app_users)
    or current_setting('helpdesk.pre_equipamentos')::bigint<>(select count(*) from public.equipamentos)
    or current_setting('helpdesk.pre_chamados')::bigint<>(select count(*) from public.chamados)
  then raise exception 'operational row count changed'; end if;
  if exists(select 1 from public.app_users group by lower(btrim(username)) having count(*)>1) then raise exception 'duplicate username created'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_users' and column_name='password_hash' and is_nullable='NO') then raise exception 'legacy required column changed'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='app_users' and policyname='app_users_read_self_or_admin') then raise exception 'RLS policy missing'; end if;
  if to_regclass('public.equipment_qr_labels') is null or to_regclass('public.equipment_qr_label_audit') is null then raise exception 'QR tables missing'; end if;
end $$;
commit;
