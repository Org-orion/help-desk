create table if not exists public.bot_messages (
  key text primary key,
  text text not null,
  updated_at timestamptz default now()
);

