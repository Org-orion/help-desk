create table if not exists public.bot_config (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz default now()
);

