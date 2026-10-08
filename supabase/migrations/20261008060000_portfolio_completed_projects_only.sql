-- SAGAMENTE: portfólio institucional apenas de projetos concluídos.
begin;
alter table public.portfolio_items
  add column if not exists source_project_id uuid references public.projects(id) on delete set null;
create unique index if not exists portfolio_items_one_per_project
  on public.portfolio_items(source_project_id) where source_project_id is not null;
alter table public.portfolio_items alter column active set default false;
comment on column public.portfolio_items.source_project_id is 'Projeto operacional de origem. Se for reaberto, a publicação é ocultada.';

create or replace function public.portfolio_project_is_complete(p_project_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists(
    select 1 from public.projects p
    where p.id=p_project_id
      and p.status='completed'
      and exists(select 1 from public.tasks t where t.project_id=p.id and t.status<>'cancelled')
      and not exists(select 1 from public.tasks t where t.project_id=p.id and t.status not in ('completed','cancelled'))
      and not exists(
        select 1 from public.task_checklist_items c
        join public.tasks t on t.id=c.task_id
        where t.project_id=p.id and t.status<>'cancelled' and c.completed=false
      )
  );
$function$;
revoke all on function public.portfolio_project_is_complete(uuid) from public;
revoke all on function public.portfolio_project_is_complete(uuid) from anon, authenticated;

drop policy if exists "public read portfolio items" on public.portfolio_items;

-- Nunca devolve o UUID do projeto interno, tarefas ou arquivos de clientes.
create or replace function public.published_portfolio_items()
returns table(
  id uuid, category_id uuid, title text, slug text, client text,
  short_description text, description text, cover_url text, project_url text,
  year integer, featured boolean, active boolean, display_order integer, category jsonb
)
language sql stable security definer set search_path=''
as $function$
  select i.id,i.category_id,i.title,i.slug,i.client,
         i.short_description,i.description,i.cover_url,i.project_url,
         i.year,i.featured,i.active,i.display_order,
         case when c.id is null then null
              else jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,
                                     'display_order',c.display_order,'active',c.active)
         end as category
  from public.portfolio_items i
  left join public.portfolio_categories c on c.id=i.category_id and c.active=true
  where i.active=true
    and i.source_project_id is not null
    and nullif(btrim(i.title),'') is not null
    and nullif(btrim(i.short_description),'') is not null
    and nullif(btrim(i.cover_url),'') is not null
    and public.portfolio_project_is_complete(i.source_project_id)
  order by i.display_order asc,i.created_at desc;
$function$;
revoke all on function public.published_portfolio_items() from public;
grant execute on function public.published_portfolio_items() to anon, authenticated;
commit;
