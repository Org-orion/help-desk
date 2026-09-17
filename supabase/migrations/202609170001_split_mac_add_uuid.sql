begin;

-- Separa o MAC por tipo de adaptador e acrescenta o UUID do dispositivo.
--
-- Os três campos são OPCIONAIS: a aplicação os exibe como "Pendente" quando
-- vazios, em vez de barrar o cadastro. Isso substitui a obrigatoriedade que a
-- coluna `mac` tinha — um desktop sem Wi-Fi ou uma impressora sem Ethernet não
-- podem ficar impedidos de ser cadastrados.
alter table public.equipamentos
  add column if not exists mac_wifi text,
  add column if not exists mac_ethernet text,
  add column if not exists uuid_dispositivo text;

-- Preserva o que havia na coluna genérica. Na prática é um único registro de
-- teste; o rótulo Ethernet é uma escolha de transição e deve ser conferido.
update public.equipamentos
   set mac_ethernet = mac
 where mac is not null and mac_ethernet is null;

drop index if exists public.idx_equipamentos_mac;
alter table public.equipamentos drop column if exists mac;

-- Cada MAC continua único entre ativos, ignorando os pendentes (NULL).
-- Wi-Fi e Ethernet são endereços distintos, então cada um tem seu índice.
create unique index if not exists idx_equipamentos_mac_wifi
  on public.equipamentos (mac_wifi) where mac_wifi is not null;
create unique index if not exists idx_equipamentos_mac_ethernet
  on public.equipamentos (mac_ethernet) where mac_ethernet is not null;
create unique index if not exists idx_equipamentos_uuid_dispositivo
  on public.equipamentos (uuid_dispositivo) where uuid_dispositivo is not null;

-- O cadastro via etiqueta QR insere com lista de colunas explícita: sem estas
-- três aqui, os campos nasceriam pendentes mesmo preenchidos no formulário.
create or replace function public.create_equipment_and_bind_qr(p_label_id uuid,p_equipment jsonb,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare equipment_id uuid; now_at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.equipment_qr_labels where id=p_label_id and status='UNUSED' for update) then raise exception 'label unavailable'; end if;
 insert into public.equipamentos(nome,tipo,patrimonio,marca,modelo,mac_wifi,mac_ethernet,uuid_dispositivo,status,usuario,setor,ram,armazenamento,processador,polegadas,ghz)
 values(p_equipment->>'nome',p_equipment->>'tipo',p_equipment->>'patrimonio',nullif(p_equipment->>'marca',''),nullif(p_equipment->>'modelo',''),nullif(p_equipment->>'mac_wifi',''),nullif(p_equipment->>'mac_ethernet',''),nullif(p_equipment->>'uuid_dispositivo',''),p_equipment->>'status',nullif(p_equipment->>'usuario',''),nullif(p_equipment->>'setor',''),nullif(p_equipment->>'ram',''),nullif(p_equipment->>'armazenamento',''),nullif(p_equipment->>'processador',''),nullif(p_equipment->>'polegadas',''),nullif(p_equipment->>'ghz','')) returning id into equipment_id;
 update public.equipment_qr_labels set status='BOUND',equipment_id=equipment_id,bound_at=now_at,bound_by_user_id=p_actor_user_id,updated_at=now_at where id=p_label_id and status='UNUSED';
 if not found then raise exception 'label conflict'; end if;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'BOUND',p_actor_user_id,equipment_id);
 return equipment_id;
end $$;

commit;
