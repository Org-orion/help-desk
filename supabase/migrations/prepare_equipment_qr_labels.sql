-- REVIEW ONLY: do not apply until the database, server sessions and rollback plan are validated.
begin;

do $$ begin
  create type public.equipment_qr_label_status as enum ('UNUSED', 'BOUND', 'REVOKED', 'VOID');
exception when duplicate_object then null;
end $$;

create table if not exists public.equipment_qr_labels (
  id uuid primary key default gen_random_uuid(),
  display_code varchar(24) not null unique check (display_code ~ '^[A-Z0-9]+(-[A-Z0-9]+)?$'),
  token_hash char(64) not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status public.equipment_qr_label_status not null default 'UNUSED',
  equipment_id uuid references public.equipamentos(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bound_at timestamptz,
  bound_by_user_id uuid references public.app_users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.app_users(id) on delete restrict,
  check ((status = 'BOUND' and equipment_id is not null and bound_at is not null and bound_by_user_id is not null) or status <> 'BOUND'),
  check ((status = 'REVOKED' and revoked_at is not null and revoked_by_user_id is not null) or status <> 'REVOKED')
);

create unique index if not exists equipment_qr_labels_one_active_per_equipment
  on public.equipment_qr_labels(equipment_id) where equipment_id is not null and status = 'BOUND';

create table if not exists public.equipment_qr_label_audit (
  id uuid primary key default gen_random_uuid(),
  label_id uuid not null references public.equipment_qr_labels(id) on delete restrict,
  action varchar(24) not null check (action in ('GENERATED','BOUND','REVOKED','REISSUED','VOIDED','REPRINTED')),
  actor_user_id uuid references public.app_users(id) on delete restrict,
  equipment_id uuid references public.equipamentos(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists equipment_qr_label_audit_label_created
  on public.equipment_qr_label_audit(label_id, created_at desc);

-- Intentionally no public/client policies. Access must use a least-privilege server role.
alter table public.equipment_qr_labels enable row level security;
alter table public.equipment_qr_label_audit enable row level security;

commit;
