create table if not exists public.equipamento_imagens (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.equipamentos(id) on delete cascade,
  storage_path text unique not null,
  nome_arquivo text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  tamanho bigint not null check (tamanho > 0 and tamanho <= 10485760),
  principal boolean not null default false,
  created_at timestamptz default now(),
  constraint equipamento_imagens_arquivo_valido check (
    lower(nome_arquivo) ~ '\.(jpe?g|png|webp)$' and
    ((lower(nome_arquivo) ~ '\.jpe?g$' and mime_type = 'image/jpeg') or
     (lower(nome_arquivo) ~ '\.png$' and mime_type = 'image/png') or
     (lower(nome_arquivo) ~ '\.webp$' and mime_type = 'image/webp'))
  )
);

create unique index if not exists idx_equipamento_imagens_principal
  on public.equipamento_imagens(equipamento_id) where principal;

alter table public.equipamento_imagens set (rowsecurity = off);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipamento-imagens', 'equipamento-imagens', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipamento imagens leitura" on storage.objects;
create policy "equipamento imagens leitura" on storage.objects
  for select using (bucket_id = 'equipamento-imagens');

drop policy if exists "equipamento imagens envio" on storage.objects;
create policy "equipamento imagens envio" on storage.objects
  for insert with check (bucket_id = 'equipamento-imagens');

drop policy if exists "equipamento imagens exclusao" on storage.objects;
create policy "equipamento imagens exclusao" on storage.objects
  for delete using (bucket_id = 'equipamento-imagens');
