begin;

-- Endereço MAC do dispositivo.
-- Coluna nullable de propósito: os ativos já cadastrados ficam com NULL
-- (tratados como "MAC pendente" pela aplicação) e devem ser regularizados
-- na edição. Para novos cadastros o preenchimento é obrigatório no formulário.
alter table public.equipamentos
  add column if not exists mac text;

-- Evita duplicidade de MAC entre ativos, ignorando os pendentes (NULL).
create unique index if not exists idx_equipamentos_mac
  on public.equipamentos (mac)
  where mac is not null;

-- O cadastro via etiqueta QR insere o equipamento por esta função, com lista
-- de colunas explícita: sem o mac aqui, o ativo nasceria pendente mesmo com o
-- campo preenchido no formulário.
create or replace function public.create_equipment_and_bind_qr(p_label_id uuid,p_equipment jsonb,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare equipment_id uuid; now_at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.equipment_qr_labels where id=p_label_id and status='UNUSED' for update) then raise exception 'label unavailable'; end if;
 insert into public.equipamentos(nome,tipo,patrimonio,marca,modelo,mac,status,usuario,setor,ram,armazenamento,processador,polegadas,ghz)
 values(p_equipment->>'nome',p_equipment->>'tipo',p_equipment->>'patrimonio',nullif(p_equipment->>'marca',''),nullif(p_equipment->>'modelo',''),nullif(p_equipment->>'mac',''),p_equipment->>'status',nullif(p_equipment->>'usuario',''),nullif(p_equipment->>'setor',''),nullif(p_equipment->>'ram',''),nullif(p_equipment->>'armazenamento',''),nullif(p_equipment->>'processador',''),nullif(p_equipment->>'polegadas',''),nullif(p_equipment->>'ghz','')) returning id into equipment_id;
 update public.equipment_qr_labels set status='BOUND',equipment_id=equipment_id,bound_at=now_at,bound_by_user_id=p_actor_user_id,updated_at=now_at where id=p_label_id and status='UNUSED';
 if not found then raise exception 'label conflict'; end if;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'BOUND',p_actor_user_id,equipment_id);
 return equipment_id;
end $$;

commit;
