begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function public.issue_equipment_qr_label(p_equipment_id uuid,p_display_code text,p_token_hash char(64),p_actor_user_id uuid,p_replace boolean default false)
returns table(id uuid,display_code varchar,status public.equipment_qr_label_status,equipment_id uuid,created_at timestamptz,updated_at timestamptz,bound_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare old_label public.equipment_qr_labels%rowtype; made public.equipment_qr_labels%rowtype; now_at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.app_users where app_users.id=p_actor_user_id and tier='admin') or not exists(select 1 from public.equipamentos where equipamentos.id=p_equipment_id for update) then raise exception 'unauthorized or missing'; end if;
 if p_display_code!~'^[A-Z0-9]+(-[A-Z0-9]+)?$' or length(p_display_code)>24 or p_token_hash!~'^[0-9a-f]{64}$' then raise exception 'invalid label'; end if;
 select * into old_label from public.equipment_qr_labels where equipment_qr_labels.equipment_id=p_equipment_id and equipment_qr_labels.status='BOUND' for update;
 if old_label.id is not null and not p_replace then raise exception 'active label exists'; end if;
 if old_label.id is not null then
  update public.equipment_qr_labels set status='REVOKED',revoked_at=now_at,revoked_by_user_id=p_actor_user_id,updated_at=now_at where equipment_qr_labels.id=old_label.id;
  insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(old_label.id,'REVOKED',p_actor_user_id,p_equipment_id);
 end if;
 insert into public.equipment_qr_labels(display_code,token_hash,status,equipment_id,bound_at,bound_by_user_id,updated_at) values(p_display_code,p_token_hash,'BOUND',p_equipment_id,now_at,p_actor_user_id,now_at) returning * into made;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(made.id,case when old_label.id is null then 'GENERATED' else 'REISSUED' end,p_actor_user_id,p_equipment_id);
 id:=made.id;display_code:=made.display_code;status:=made.status;equipment_id:=made.equipment_id;created_at:=made.created_at;updated_at:=made.updated_at;bound_at:=made.bound_at;revoked_at:=made.revoked_at;return next;
end $$;

create or replace function public.create_equipment_and_bind_qr(p_label_id uuid,p_equipment jsonb,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare equipment_id uuid; now_at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.equipment_qr_labels where id=p_label_id and status='UNUSED' for update) then raise exception 'label unavailable'; end if;
 insert into public.equipamentos(nome,tipo,patrimonio,marca,modelo,status,usuario,setor,ram,armazenamento,processador,polegadas,ghz)
 values(p_equipment->>'nome',p_equipment->>'tipo',p_equipment->>'patrimonio',nullif(p_equipment->>'marca',''),nullif(p_equipment->>'modelo',''),p_equipment->>'status',nullif(p_equipment->>'usuario',''),nullif(p_equipment->>'setor',''),nullif(p_equipment->>'ram',''),nullif(p_equipment->>'armazenamento',''),nullif(p_equipment->>'processador',''),nullif(p_equipment->>'polegadas',''),nullif(p_equipment->>'ghz','')) returning id into equipment_id;
 update public.equipment_qr_labels set status='BOUND',equipment_id=equipment_id,bound_at=now_at,bound_by_user_id=p_actor_user_id,updated_at=now_at where id=p_label_id and status='UNUSED';
 if not found then raise exception 'label conflict'; end if;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'BOUND',p_actor_user_id,equipment_id);
 return equipment_id;
end $$;

create or replace function public.rotate_equipment_qr_token(p_label_id uuid,p_token_hash char(64),p_actor_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare linked_equipment uuid;
begin
 if p_token_hash!~'^[0-9a-f]{64}$' or not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'invalid input'; end if;
 update public.equipment_qr_labels set token_hash=p_token_hash,updated_at=clock_timestamp() where id=p_label_id and status='BOUND' returning equipment_id into linked_equipment;
 if not found then raise exception 'label unavailable'; end if;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'REISSUED',p_actor_user_id,linked_equipment);
 return true;
end $$;

create or replace function public.revoke_equipment_qr_label(p_label_id uuid,p_actor_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare linked_equipment uuid; now_at timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from public.app_users where id=p_actor_user_id and tier='admin') then raise exception 'unauthorized'; end if;
 update public.equipment_qr_labels set status='REVOKED',revoked_at=now_at,revoked_by_user_id=p_actor_user_id,updated_at=now_at where id=p_label_id and status in ('UNUSED','BOUND') returning equipment_id into linked_equipment;
 if not found then raise exception 'label unavailable'; end if;
 insert into public.equipment_qr_label_audit(label_id,action,actor_user_id,equipment_id) values(p_label_id,'REVOKED',p_actor_user_id,linked_equipment);
 return true;
end $$;

revoke all on function public.issue_equipment_qr_label(uuid,text,char,uuid,boolean) from public,anon,authenticated;
revoke all on function public.create_equipment_and_bind_qr(uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.rotate_equipment_qr_token(uuid,char,uuid) from public,anon,authenticated;
revoke all on function public.revoke_equipment_qr_label(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_equipment_qr_label(uuid,text,char,uuid,boolean) to service_role;
grant execute on function public.create_equipment_and_bind_qr(uuid,jsonb,uuid) to service_role;
grant execute on function public.rotate_equipment_qr_token(uuid,char,uuid) to service_role;
grant execute on function public.revoke_equipment_qr_label(uuid,uuid) to service_role;
commit;
