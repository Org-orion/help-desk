-- NOTE: For development, RLS is disabled. Enable and add proper policies for production.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  name text not null,
  setor text,
  cargo text,
  password_hash text not null,
  tier text not null check (tier in ('padrao','vip','admin')),
  is_admin boolean generated always as (tier = 'admin') stored,
  created_at timestamptz default now()
);

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null,
  responsavel text,
  ramal text,
  localizacao text,
  created_at timestamptz default now()
);

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  patrimonio text unique not null,
  status text not null check (status in ('Disponível','Em Uso','Manutenção','Inativo')),
  usuario text,
  setor text,
  marca text,
  modelo text,
  ram text,
  armazenamento text,
  processador text,
  polegadas text,
  ghz text,
  created_at timestamptz default now()
);

create table if not exists public.equipamento_imagens (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.equipamentos(id) on delete cascade,
  storage_path text unique not null,
  nome_arquivo text not null check (
    lower(nome_arquivo) ~ '\.(jpe?g|png|webp)$' and
    ((lower(nome_arquivo) ~ '\.jpe?g$' and mime_type = 'image/jpeg') or
     (lower(nome_arquivo) ~ '\.png$' and mime_type = 'image/png') or
     (lower(nome_arquivo) ~ '\.webp$' and mime_type = 'image/webp'))
  ),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  tamanho bigint not null check (tamanho > 0 and tamanho <= 10485760),
  principal boolean not null default false,
  created_at timestamptz default now()
);

create unique index if not exists idx_equipamento_imagens_principal
  on public.equipamento_imagens(equipamento_id) where principal;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipamento-imagens', 'equipamento-imagens', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipamento imagens leitura" on storage.objects;
create policy "equipamento imagens leitura" on storage.objects for select using (bucket_id = 'equipamento-imagens');
drop policy if exists "equipamento imagens envio" on storage.objects;
create policy "equipamento imagens envio" on storage.objects for insert with check (bucket_id = 'equipamento-imagens');
drop policy if exists "equipamento imagens exclusao" on storage.objects;
create policy "equipamento imagens exclusao" on storage.objects for delete using (bucket_id = 'equipamento-imagens');

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  descricao text,
  estoque integer not null default 0,
  created_at timestamptz default now()
);

alter table public.produtos add constraint produtos_estoque_nonneg check (estoque >= 0);

create table if not exists public.produto_saidas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  quantidade integer not null,
  destinatario text,
  data date not null default (now()::date),
  created_at timestamptz default now()
);

alter table public.produto_saidas add constraint produto_saidas_quantidade_pos check (quantidade > 0);

create or replace function public.produto_saidas_update_estoque() returns trigger language plpgsql as $$
begin
  update public.produtos set estoque = greatest(0, estoque - NEW.quantidade) where id = NEW.produto_id;
  return NEW;
end;
$$;

create trigger trg_produto_saidas_after_insert
after insert on public.produto_saidas
for each row execute function public.produto_saidas_update_estoque();

create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  prioridade text not null check (prioridade in ('baixa','media','alta')),
  status text not null check (status in ('Aberto','Em Andamento','Concluído')),
  usuario text not null,
  solicitante text not null,
  setor text not null,
  tipo_servico text not null,
  is_vip boolean not null default false,
  data date not null default (now()::date),
  started_at timestamptz,
  completed_at timestamptz,
  solution_duration_min integer,
  tempo_solucao_minutos integer,
  tempo_solucao_texto text,
  created_at timestamptz default now()
);

ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS solution_duration_min integer;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS tempo_solucao_minutos integer;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS tempo_solucao_texto text;

create or replace function public.chamados_set_priority() returns trigger language plpgsql as $$
begin
  if NEW.is_vip then NEW.prioridade := 'alta'; end if;
  return NEW;
end;
$$;

create trigger trg_chamados_before_insert
before insert on public.chamados
for each row execute function public.chamados_set_priority();

-- Disable RLS for dev
alter table public.app_users set (rowsecurity = off);
alter table public.setores set (rowsecurity = off);
alter table public.equipamentos set (rowsecurity = off);
alter table public.equipamento_imagens set (rowsecurity = off);
alter table public.produtos set (rowsecurity = off);
alter table public.produto_saidas set (rowsecurity = off);
alter table public.chamados set (rowsecurity = off);

create index if not exists idx_app_users_tier on public.app_users(tier);
create index if not exists idx_equipamentos_status on public.equipamentos(status);
create index if not exists idx_produtos_categoria on public.produtos(categoria);
create index if not exists idx_produto_saidas_produto_data on public.produto_saidas(produto_id, data);
create index if not exists idx_chamados_status on public.chamados(status);
create index if not exists idx_chamados_prioridade on public.chamados(prioridade);
create index if not exists idx_chamados_data on public.chamados(data);
create index if not exists idx_chamados_started_at on public.chamados(started_at);
create index if not exists idx_chamados_completed_at on public.chamados(completed_at);
create index if not exists idx_chamados_solution_duration on public.chamados(solution_duration_min);
create index if not exists idx_chamados_tempo_solucao_minutos on public.chamados(tempo_solucao_minutos);
