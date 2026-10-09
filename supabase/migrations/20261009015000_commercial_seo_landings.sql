-- SEO commercial landing pages: add without overwriting edits made by admins.
-- Existing keyword assignments are moved only from their original divisional route.
begin;
insert into public.seo_pages(path,title,description,primary_keyword,secondary_keywords,noindex,published)
values
 ('/solucoes/identidade-visual','Criação de Identidade Visual para Empresas | Sagamente','Precisa de logotipo e identidade visual para sua empresa ou projeto? Conheça as soluções da Sagamente, compare opções e solicite uma proposta.','criação de identidade visual para empresas','{}'::text[],false,true),
 ('/solucoes/criacao-de-sites','Criação de Sites Profissionais e Landing Pages | Sagamente','Criação de sites institucionais, páginas de vendas e soluções web. Compare os serviços da Sagamente e encontre a opção adequada para seu negócio.','criação de sites profissionais','{}'::text[],false,true),
 ('/solucoes/edicao-de-videos','Edição de Vídeos e Reels para Empresas | Sagamente','Edição de reels, vídeos para redes sociais e vídeos institucionais. Conheça opções do Studio Sagamente e solicite orçamento de edição audiovisual.','edição de vídeos para empresas','{}'::text[],false,true)
on conflict (path) do nothing;
insert into public.seo_keywords(phrase,page_path,intent,priority,notes)
values
 ('criação de identidade visual para empresas','/solucoes/identidade-visual','commercial','high','Termo central para página comercial; volume de pesquisa e ranking não medidos'),
 ('criação de sites profissionais','/solucoes/criacao-de-sites','commercial','high','Termo central para página comercial; volume de pesquisa e ranking não medidos'),
 ('edição de vídeos para empresas','/solucoes/edicao-de-videos','commercial','high','Termo central para página comercial; volume de pesquisa e ranking não medidos')
on conflict (phrase) do nothing;
update public.seo_keywords set page_path='/solucoes/identidade-visual',updated_at=now()
where page_path='/design' and lower(phrase) in ('orçamento de criação de logotipo','criação de identidade visual para pequenas empresas','quanto custa identidade visual');
update public.seo_keywords set page_path='/solucoes/criacao-de-sites',updated_at=now()
where page_path='/tech' and lower(phrase) in ('orçamento para criação de site','criação de site profissional para empresas','criação de landing page profissional','criação de site institucional','contratar desenvolvedor de sites');
update public.seo_keywords set page_path='/solucoes/edicao-de-videos',updated_at=now()
where page_path='/studio' and lower(phrase) in ('contratar editor de vídeo','edição de reels para empresas','edição de vídeo para redes sociais','orçamento de vídeo institucional','produção de vídeo institucional para empresas');
commit;
