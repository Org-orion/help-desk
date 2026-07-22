create table if not exists public.equipamento_imagens (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null,
  storage_path text unique not null,
  nome_arquivo text not null,
  mime_type text not null,
  tamanho bigint not null,
  principal boolean not null default false,
  created_at timestamptz not null default now(),

  constraint equipamento_imagens_equipamento_fk
    foreign key (equipamento_id)
    references public.equipamentos(id)
    on delete cascade,

  constraint equipamento_imagens_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),

  constraint equipamento_imagens_tamanho_check
    check (tamanho > 0 and tamanho <= 10485760),

  constraint equipamento_imagens_arquivo_valido_check
    check (
      lower(nome_arquivo) ~ '\.(jpe?g|png|webp)$'
      and (
        (lower(nome_arquivo) ~ '\.jpe?g$' and mime_type = 'image/jpeg')
        or (lower(nome_arquivo) ~ '\.png$' and mime_type = 'image/png')
        or (lower(nome_arquivo) ~ '\.webp$' and mime_type = 'image/webp')
      )
    )
);

create unique index if not exists idx_equipamento_imagens_principal
  on public.equipamento_imagens (equipamento_id)
  where principal;

create index if not exists idx_equipamento_imagens_equipamento_created
  on public.equipamento_imagens (equipamento_id, created_at);

alter table public.equipamento_imagens enable row level security;

revoke all on table public.equipamento_imagens from anon;
revoke all on table public.equipamento_imagens from authenticated;

grant select, insert, update, delete
  on table public.equipamento_imagens
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipamento_imagens'
      and policyname = 'equipamento_imagens_select_admin'
  ) then
    create policy equipamento_imagens_select_admin
      on public.equipamento_imagens
      for select
      to authenticated
      using (public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipamento_imagens'
      and policyname = 'equipamento_imagens_insert_admin'
  ) then
    create policy equipamento_imagens_insert_admin
      on public.equipamento_imagens
      for insert
      to authenticated
      with check (public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipamento_imagens'
      and policyname = 'equipamento_imagens_update_admin'
  ) then
    create policy equipamento_imagens_update_admin
      on public.equipamento_imagens
      for update
      to authenticated
      using (public.current_user_is_app_admin())
      with check (public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'equipamento_imagens'
      and policyname = 'equipamento_imagens_delete_admin'
  ) then
    create policy equipamento_imagens_delete_admin
      on public.equipamento_imagens
      for delete
      to authenticated
      using (public.current_user_is_app_admin());
  end if;
end
$$;

notify pgrst, 'reload schema';
