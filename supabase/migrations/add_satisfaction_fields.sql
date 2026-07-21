-- Add satisfaction evaluation fields to chamados
alter table public.chamados
  add column if not exists avaliacao integer check (avaliacao between 1 and 5);
alter table public.chamados
  add column if not exists comentario_avaliacao text;
alter table public.chamados
  add column if not exists data_avaliacao timestamptz;
alter table public.chamados
  add column if not exists avaliado boolean default false;

