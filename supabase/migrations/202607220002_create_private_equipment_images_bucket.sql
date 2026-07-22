insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'equipamento-imagens',
  'equipamento-imagens',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'equipamento_imagens_select_admin'
  ) then
    create policy equipamento_imagens_select_admin on storage.objects
      for select to authenticated
      using (bucket_id = 'equipamento-imagens' and public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'equipamento_imagens_insert_admin'
  ) then
    create policy equipamento_imagens_insert_admin on storage.objects
      for insert to authenticated
      with check (bucket_id = 'equipamento-imagens' and public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'equipamento_imagens_update_admin'
  ) then
    create policy equipamento_imagens_update_admin on storage.objects
      for update to authenticated
      using (bucket_id = 'equipamento-imagens' and public.current_user_is_app_admin())
      with check (bucket_id = 'equipamento-imagens' and public.current_user_is_app_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'equipamento_imagens_delete_admin'
  ) then
    create policy equipamento_imagens_delete_admin on storage.objects
      for delete to authenticated
      using (bucket_id = 'equipamento-imagens' and public.current_user_is_app_admin());
  end if;
end
$$;
