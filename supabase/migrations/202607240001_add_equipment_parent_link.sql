begin;

alter table public.equipamentos
  add column if not exists equipamento_pai_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipamentos_equipamento_pai_id_fkey'
      and conrelid = 'public.equipamentos'::regclass
  ) then
    alter table public.equipamentos
      add constraint equipamentos_equipamento_pai_id_fkey
      foreign key (equipamento_pai_id)
      references public.equipamentos(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_equipamentos_equipamento_pai_id
  on public.equipamentos(equipamento_pai_id);

create or replace function public.validate_equipamento_parent_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_parent_id uuid;
begin
  if new.equipamento_pai_id is null then
    return new;
  end if;

  if new.id = new.equipamento_pai_id then
    raise exception 'EQUIPMENT_LINK_SELF'
      using errcode = '23514';
  end if;

  select parent.equipamento_pai_id
    into parent_parent_id
  from public.equipamentos as parent
  where parent.id = new.equipamento_pai_id
  for update;

  if not found then
    raise exception 'EQUIPMENT_LINK_PARENT_NOT_FOUND'
      using errcode = '23503';
  end if;

  if parent_parent_id is not null then
    raise exception 'EQUIPMENT_LINK_PARENT_IS_LINKED'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.equipamentos as child
    where child.equipamento_pai_id = new.id
      and child.id <> new.id
  ) then
    raise exception 'EQUIPMENT_LINK_CHILD_HAS_LINKS'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists trg_validate_equipamento_parent_link
  on public.equipamentos;

create trigger trg_validate_equipamento_parent_link
before insert or update of equipamento_pai_id
on public.equipamentos
for each row
execute function public.validate_equipamento_parent_link();

commit;
