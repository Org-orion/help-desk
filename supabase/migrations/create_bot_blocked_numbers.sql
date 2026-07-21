create table if not exists public.bot_blocked_numbers (
  number text primary key,
  created_at timestamptz default now()
);

