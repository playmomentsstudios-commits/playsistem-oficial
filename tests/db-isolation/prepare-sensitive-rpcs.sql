\set ON_ERROR_STOP on
-- Synthetic signatures only. This file MUST be run in ephemeral local PostgreSQL,
-- never against Supabase production (which contains business implementations).
create or replace function public.release_order_stock(p_order_id uuid)
returns void language plpgsql as $$ begin return; end; $$;

create or replace function public.submit_file_review(
  p_file_id uuid, p_action text, p_comment text)
returns void language plpgsql as $$ begin return; end; $$;

create or replace function public.submit_file_review_v2(
  p_file_id uuid, p_action text, p_comment text,
  p_subject text, p_items jsonb, p_attachments jsonb)
returns void language plpgsql as $$ begin return; end; $$;

grant execute on function public.release_order_stock(uuid)
  to public, anon, authenticated, service_role;
grant execute on function public.submit_file_review(uuid,text,text)
  to public, anon, authenticated, service_role;
grant execute on function public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)
  to public, anon, authenticated, service_role;

do $$
begin
  if not has_function_privilege('anon','public.release_order_stock(uuid)','execute')
     or not has_function_privilege('anon','public.submit_file_review(uuid,text,text)','execute')
     or not has_function_privilege('anon','public.submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)','execute')
    then raise exception 'Fixture invalid: functions must initially be callable by anon';
  end if;
end $$;
