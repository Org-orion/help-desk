begin;

-- Permissão de excluir ativos. Fica no banco, e não no código, para que
-- transferir ou compartilhar a permissão seja um update — sem deploy.
alter table public.app_users
  add column if not exists pode_excluir_ativos boolean not null default false;

-- app_users tem grant POR COLUNA: `authenticated` só lê o que está listado em
-- 202607200001_secure_auth_migration.sql. Sem esta linha a leitura do perfil
-- devolve 403 e o app desloga o usuário.
grant select (pode_excluir_ativos) on public.app_users to authenticated;

-- RLS está desligado em equipamentos: sem este revoke, a chave anônima que vai
-- no bundle do frontend apaga qualquer ativo direto pela API, por mais que a
-- tela esconda o botão. O delete passa a existir só através da função abaixo.
revoke delete on public.equipamentos from anon, authenticated;

-- Exclui um ativo conferindo a permissão no servidor e soltando as referências
-- que hoje bloqueiam o delete com `on delete restrict`.
create or replace function public.excluir_equipamento(p_equipment_id uuid, p_actor_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1 from public.app_users
     where id = p_actor_user_id and pode_excluir_ativos
  ) then
    raise exception 'EQUIPMENT_DELETE_FORBIDDEN' using errcode = '42501';
  end if;

  if not exists(select 1 from public.equipamentos where id = p_equipment_id) then
    raise exception 'EQUIPMENT_DELETE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A trilha de etiquetas não pode apontar para um ativo que deixou de existir.
  -- Em vez de apagar o histórico, registra a invalidação e solta o vínculo.
  insert into public.equipment_qr_label_audit(label_id, action, actor_user_id, equipment_id)
  select id, 'VOIDED', p_actor_user_id, null
    from public.equipment_qr_labels
   where equipment_id = p_equipment_id;

  update public.equipment_qr_labels
     set status = 'VOID', equipment_id = null, updated_at = clock_timestamp()
   where equipment_id = p_equipment_id;

  update public.equipment_qr_label_audit
     set equipment_id = null
   where equipment_id = p_equipment_id;

  -- Equipamentos vinculados a este passam a ser independentes.
  update public.equipamentos
     set equipamento_pai_id = null
   where equipamento_pai_id = p_equipment_id;

  delete from public.equipamentos where id = p_equipment_id;
end $$;

revoke all on function public.excluir_equipamento(uuid, uuid) from public;
grant execute on function public.excluir_equipamento(uuid, uuid) to anon, authenticated;

commit;
