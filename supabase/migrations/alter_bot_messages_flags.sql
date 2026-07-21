alter table if exists public.bot_messages
  add column if not exists include_cancel boolean default false,
  add column if not exists include_help boolean default false;

