-- Active and review tasks require an active staff or admin owner.
-- Existing orphaned tasks stay visible so an operator can assign the correct person.
create or replace function public.guard_active_task_owner()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.status in ('in_progress', 'review') then
    if new.assigned_to is null then
      raise exception 'Atribua um responsável antes de iniciar ou enviar a tarefa para revisão.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.profiles p
      left join public.staff_profiles sp on sp.user_id = p.id
      where p.id = new.assigned_to
        and p.status = 'active'
        and (
          p.role = 'admin'
          or (p.role = 'staff' and coalesce(sp.active, false))
        )
    ) then
      raise exception 'O responsável da tarefa precisa ser um administrador ou colaborador ativo.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists tasks_active_status_requires_owner on public.tasks;
create trigger tasks_active_status_requires_owner
before insert or update of status, assigned_to
on public.tasks
for each row
execute function public.guard_active_task_owner();
