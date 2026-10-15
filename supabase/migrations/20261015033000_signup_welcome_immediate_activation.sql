-- Compatibility layer: instant signup (Supabase Confirm Email disabled) and legacy
-- email-confirmed registrations both issue welcome events exactly once.
-- Does not change provider settings; those are managed in Authentication > Providers > Email.
-- The previously created customer_onboarding_events unique key prevents duplicate notices.
create or replace function public.customer_welcome_after_email_confirmation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_profile public.profiles%rowtype;
 v_name text;
 v_first text;
 v_welcome uuid;
 v_message text;
 v_inserted uuid;
begin
 -- INSERT occurs for automatically activated accounts when Confirm Email is disabled.
 -- UPDATE remains the existing path for email-confirmation-enabled projects.
 if new.email_confirmed_at is null or new.is_anonymous is true then return new; end if;
 if tg_op='UPDATE' and old.email_confirmed_at is not null then return new; end if;
 select * into v_profile from public.profiles p where p.id=new.id;
 if not found or v_profile.role <> 'customer' or v_profile.status <> 'active' then
    return new;
 end if;
 insert into public.customer_onboarding_events(user_id,email_confirmed_at)
 values(new.id,new.email_confirmed_at)
 on conflict(user_id) do nothing returning user_id into v_inserted;
 if v_inserted is null then return new; end if;

 v_name := btrim(concat_ws(' ',nullif(v_profile.first_name,''),nullif(v_profile.last_name,'')));
 v_first := nullif(split_part(v_name,' ',1),'');
 if v_first is null then v_first:='cliente'; end if;
 v_first := left(regexp_replace(v_first,'[^[:alnum:]À-ÿ -]','','g'),60);
 insert into public.notifications(user_id,type,title,message,link,metadata)
 values(new.id,'account_welcome','Boas-vindas à Sagamente!',
   'Sua conta está ativa! Explore cursos, materiais, pedidos e projetos na Sagamente.',
   '/app',jsonb_build_object('source','activated_signup','customer_id',new.id))
 returning id into v_welcome;

 if public.wa_bridge_customer_eligible(new.id) then
   v_message := 'Olá, *'||v_first||'*! 👋'||E'\n\n'
    ||'*Boas-vindas à Sagamente!*'||E'\n\n'
    ||'Sua conta Sagamente está ativa. '
    ||'No seu painel você pode consultar pedidos, acompanhar projetos, acessar cursos, materiais, e-books e audiobooks.'
    ||E'\n\n🔗 *Acessar meu painel:*\n'
    ||'https://playsistem-oficial.playmomentsstudios.workers.dev/app'
    ||E'\n\nPara cancelar avisos pelo WhatsApp, acesse as configurações da sua conta.'
    ||E'\n\n*Equipe Sagamente*';
   insert into public.whatsapp_message_outbox(
     notification_id,recipient_user_id,recipient_name,destination_phone,event_type,
     title,message_body,target_link,status,source
   ) values (
     v_welcome,new.id,coalesce(nullif(v_name,''),'Cliente'),
     (select wa_opt_in_phone from public.user_preferences where user_id=new.id),
     'account_welcome','Boas-vindas à Sagamente!',v_message,
     '/app','ready_manual','live'
   ) on conflict(notification_id) do nothing;
 end if;

 insert into public.notifications(user_id,type,title,message,link,metadata)
 select admin.id,'new_customer_signup','Novo cliente cadastrado',
    'Novo cadastro ativado: '||coalesce(nullif(v_name,''),'Cliente')||'.',
    '/admin/clientes/'||new.id::text,
    jsonb_build_object('source','activated_signup','customer_id',new.id)
 from public.profiles admin
 where admin.role='admin' and admin.status='active' and admin.id<>new.id;

 return new;
exception when others then
 raise warning 'customer_welcome_after_email_confirmation failed for an activated account: %',sqlstate;
 return new;
end $$;
-- The existing AFTER UPDATE trigger continues to handle accounts awaiting verification.
-- Trigger ordering matters: on_auth_user_created first creates the profile and preferences.
drop trigger if exists zz_customer_immediate_account_welcome on auth.users;
create trigger zz_customer_immediate_account_welcome
after insert on auth.users
for each row when (new.email_confirmed_at is not null and new.is_anonymous is false)
execute function public.customer_welcome_after_email_confirmation();
revoke all on function public.customer_welcome_after_email_confirmation() from public,anon,authenticated;
