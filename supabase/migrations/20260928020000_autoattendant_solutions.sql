-- Configurable, deterministic knowledge base for the free auto-attendant.
create table if not exists public.autoattendant_solutions(
 id uuid primary key default gen_random_uuid(),
 name text not null,
 kind text not null check(kind in ('service','product','academy','support')),
 keywords text[] not null default '{}',
 response text not null,
 question text,
 route text,
 crm_event text,
 active boolean not null default true,
 priority integer not null default 100,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists autoattendant_solutions_active_priority_idx on public.autoattendant_solutions(active,priority desc);
alter table public.autoattendant_solutions enable row level security;
drop policy if exists autoattendant_solutions_customer_read on public.autoattendant_solutions;
create policy autoattendant_solutions_customer_read on public.autoattendant_solutions for select to authenticated using(active or public.current_user_is_admin());
drop policy if exists autoattendant_solutions_admin_write on public.autoattendant_solutions;
create policy autoattendant_solutions_admin_write on public.autoattendant_solutions for all to authenticated using(public.current_user_is_admin()) with check(public.current_user_is_admin());
grant select on public.autoattendant_solutions to authenticated;
grant insert,update,delete on public.autoattendant_solutions to authenticated;

insert into public.autoattendant_solutions(name,kind,keywords,response,question,route,crm_event,priority)
values
('Identidade visual','service',array['logo','logotipo','marca','identidade visual','branding'],'Podemos direcionar você para uma solução de identidade visual, desde uma marca nova até uma reformulação.','É uma marca nova ou você quer reformular uma identidade que já existe?','/servicos','service_interest',130),
('Sites e soluções web','service',array['site','website','landing page','loja virtual','ecommerce','e-commerce','sistema web'],'Temos soluções para presença institucional, páginas de campanha, vendas online e projetos web personalizados.','Você precisa apresentar a empresa, captar contatos, vender online ou criar uma função específica?','/servicos','service_interest',125),
('Vídeo e audiovisual','service',array['video','vídeo','filmagem','reels','audiovisual','cobertura','edição de vídeo'],'Podemos direcionar para captação, edição, conteúdo curto, cobertura ou produção audiovisual personalizada.','Você já possui o material para editar ou precisa também de captação?','/servicos','service_interest',120),
('Áudio e produção musical','service',array['audio','áudio','musica','música','produção musical','mixagem','masterização','dj'],'A Play Moments trabalha com soluções de áudio e produção musical de acordo com a etapa do projeto.','Você já possui uma gravação/material ou quer iniciar a produção do zero?','/servicos','service_interest',115),
('Produtos e equipamentos','product',array['produto','equipamento','celular','notebook','computador','camera','câmera','acessorio','acessório'],'Posso levar você ao catálogo para conferir os produtos e equipamentos disponíveis agora.','Você já sabe qual produto procura ou quer comparar as opções disponíveis?','/produtos','product_interest',110)
on conflict do nothing;
