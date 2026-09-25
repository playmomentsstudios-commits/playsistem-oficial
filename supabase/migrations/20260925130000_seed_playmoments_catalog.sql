-- Catálogo comercial Play Moments: ofertas de serviços tratadas como produtos de catálogo.
-- Preços-base usam o preço-alvo definido em 25/09/2026.
-- Idempotente: categorias e produtos são identificados pelo slug.

alter table public.products
  add column if not exists inventory_tracked boolean not null default true;

alter table public.product_categories
  add column if not exists specifications jsonb not null default '{}'::jsonb;

insert into public.product_categories(name,slug,description,active,display_order,specifications)
values
  ('Design Gráfico','design-grafico','Peças gráficas, materiais promocionais e comunicação visual.',true,10,jsonb_build_object('cover_asset','/catalog-icons/design.svg')),
  ('Branding & Identidade','branding-identidade','Logotipos, identidades visuais, naming e sistemas de marca.',true,20,jsonb_build_object('cover_asset','/catalog-icons/branding.svg')),
  ('Social Media & Conteúdo','social-media-conteudo','Conteúdo visual, kits, campanhas e gestão criativa para redes.',true,30,jsonb_build_object('cover_asset','/catalog-icons/social.svg')),
  ('Web & Sistemas','web-sistemas','Landing pages, sites, lojas virtuais, portais e sistemas.',true,40,jsonb_build_object('cover_asset','/catalog-icons/web.svg')),
  ('Vídeo & Audiovisual','video-audiovisual','Edição, captação, cobertura, vídeo institucional e conteúdo audiovisual.',true,50,jsonb_build_object('cover_asset','/catalog-icons/video.svg')),
  ('Motion Graphics','motion-graphics','Animações, vinhetas, motion para marcas e redes sociais.',true,60,jsonb_build_object('cover_asset','/catalog-icons/motion.svg')),
  ('Áudio & Música','audio-musica','Edição, mixagem, masterização, podcast e produção musical.',true,70,jsonb_build_object('cover_asset','/catalog-icons/audio.svg')),
  ('DJ & Eventos','dj-eventos','Apresentações de DJ e soluções musicais para eventos.',true,80,jsonb_build_object('cover_asset','/catalog-icons/dj.svg')),
  ('Comercial & Institucional','comercial-institucional','Materiais comerciais, institucionais, culturais e projetos especiais.',true,90,jsonb_build_object('cover_asset','/catalog-icons/institucional.svg'))
on conflict(slug) do update set
  name=excluded.name,
  description=excluded.description,
  active=true,
  display_order=excluded.display_order,
  specifications=public.product_categories.specifications || excluded.specifications;

with seed(category_slug,name,slug,sku,short_description,description,sale_price,cover_asset,featured) as (
  values
  ('design-grafico','Post Estático Avulso','post-estatico-avulso','PM-001','Arte profissional para feed.','Arte profissional para feed. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',15000,'/catalog-icons/design.svg',true),
  ('design-grafico','Story Avulso','story-avulso','PM-002','Story profissional para campanhas e divulgação.','Story profissional para campanhas e divulgação. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',12000,'/catalog-icons/design.svg',true),
  ('design-grafico','Carrossel 5 Páginas','carrossel-5-paginas','PM-003','Carrossel visual com até 5 páginas.','Carrossel visual com até 5 páginas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',45000,'/catalog-icons/social.svg',true),
  ('design-grafico','Flyer / Cartaz Digital','flyer-cartaz-digital','PM-004','Flyer ou cartaz para divulgação.','Flyer ou cartaz para divulgação. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',45000,'/catalog-icons/design.svg',true),
  ('design-grafico','Banner Digital','banner-digital','PM-005','Banner promocional para web e redes.','Banner promocional para web e redes. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',35000,'/catalog-icons/design.svg',true),
  ('design-grafico','Thumbnail / Capa','thumbnail-capa','PM-006','Capa para vídeo, YouTube, destaque ou conteúdo.','Capa para vídeo, YouTube, destaque ou conteúdo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',16000,'/catalog-icons/design.svg',true),
  ('design-grafico','Cartão de Visita','cartao-de-visita','PM-007','Layout profissional frente e verso.','Layout profissional frente e verso. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',30000,'/catalog-icons/design.svg',true),
  ('design-grafico','Convite Digital','convite-digital','PM-008','Convite digital personalizado.','Convite digital personalizado. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',25000,'/catalog-icons/design.svg',true),
  ('design-grafico','Cardápio Digital','cardapio-digital','PM-009','Cardápio visual para bares, restaurantes e eventos.','Cardápio visual para bares, restaurantes e eventos. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',65000,'/catalog-icons/design.svg',true),
  ('design-grafico','Catálogo Comercial','catalogo-comercial','PM-010','Catálogo profissional de produtos ou serviços.','Catálogo profissional de produtos ou serviços. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/design.svg',true),
  ('design-grafico','Apresentação Profissional','apresentacao-profissional','PM-011','Apresentação comercial ou institucional.','Apresentação comercial ou institucional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/institucional.svg',true),
  ('design-grafico','Media Kit','media-kit','PM-012','Media kit profissional para marcas e criadores.','Media kit profissional para marcas e criadores. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',85000,'/catalog-icons/institucional.svg',true),
  ('design-grafico','Currículo Visual Profissional','curriculo-visual-profissional','PM-013','Currículo com apresentação visual profissional.','Currículo com apresentação visual profissional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',35000,'/catalog-icons/design.svg',false),
  ('design-grafico','Folder / Folheto','folder-folheto','PM-014','Material promocional pronto para impressão.','Material promocional pronto para impressão. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',50000,'/catalog-icons/design.svg',false),
  ('design-grafico','Outdoor / Painel','outdoor-painel','PM-015','Arte de grande formato para campanha.','Arte de grande formato para campanha. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',70000,'/catalog-icons/design.svg',false),
  ('design-grafico','Fachada / Placa Comercial','fachada-placa-comercial','PM-016','Projeto visual aplicado a fachada ou placa.','Projeto visual aplicado a fachada ou placa. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/design.svg',false),
  ('branding-identidade','Logo Essencial','logo-essencial','PM-017','Criação de logotipo profissional.','Criação de logotipo profissional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',150000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Logo Profissional','logo-profissional','PM-018','Projeto de marca com aprofundamento visual.','Projeto de marca com aprofundamento visual. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',250000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Identidade Visual Básica','identidade-visual-basica','PM-019','Base completa para apresentação da marca.','Base completa para apresentação da marca. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',350000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Identidade Visual Completa','identidade-visual-completa','PM-020','Sistema visual completo para posicionamento de marca.','Sistema visual completo para posicionamento de marca. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',550000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Redesign de Marca','redesign-de-marca','PM-021','Atualização estratégica de uma marca existente.','Atualização estratégica de uma marca existente. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Naming de Marca','naming-de-marca','PM-022','Desenvolvimento de opções de nome para negócio ou projeto.','Desenvolvimento de opções de nome para negócio ou projeto. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Manual de Marca','manual-de-marca','PM-023','Guia de aplicação da identidade visual.','Guia de aplicação da identidade visual. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',160000,'/catalog-icons/branding.svg',false),
  ('branding-identidade','Kit Papelaria da Marca','kit-papelaria-marca','PM-024','Aplicações institucionais da identidade.','Aplicações institucionais da identidade. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/branding.svg',false),
  ('social-media-conteudo','Kit 5 Artes para Redes','kit-5-artes-redes','PM-025','Pacote com 5 peças estáticas.','Pacote com 5 peças estáticas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',65000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit 10 Artes para Redes','kit-10-artes-redes','PM-026','Pacote com 10 peças para conteúdo.','Pacote com 10 peças para conteúdo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit 20 Artes para Redes','kit-20-artes-redes','PM-027','Pacote ampliado com 20 peças.','Pacote ampliado com 20 peças. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',210000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit de Lançamento','kit-lancamento','PM-028','Peças para lançamento de produto, serviço ou projeto.','Peças para lançamento de produto, serviço ou projeto. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit de Evento','kit-evento','PM-029','Comunicação visual para divulgação de evento.','Comunicação visual para divulgação de evento. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit Restaurante / Gastronomia','kit-restaurante-gastronomia','PM-030','Conteúdo promocional para bares e restaurantes.','Conteúdo promocional para bares e restaurantes. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',110000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','10 Templates Editáveis','10-templates-editaveis','PM-031','Templates reutilizáveis para comunicação recorrente.','Templates reutilizáveis para comunicação recorrente. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',95000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Social Media Essencial - Mensal','social-media-essencial-mensal','PM-032','Pacote mensal de criação e organização de conteúdo.','Pacote mensal de criação e organização de conteúdo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',200000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Social Media Completo - Mensal','social-media-completo-mensal','PM-033','Gestão criativa mensal ampliada.','Gestão criativa mensal ampliada. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',300000,'/catalog-icons/social.svg',false),
  ('social-media-conteudo','Kit 5 Criativos para Anúncios','kit-5-criativos-anuncios','PM-034','Criativos focados em campanhas e conversão.','Criativos focados em campanhas e conversão. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',80000,'/catalog-icons/social.svg',false),
  ('web-sistemas','Landing Page','landing-page','PM-035','Página única focada em apresentação e conversão.','Página única focada em apresentação e conversão. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',280000,'/catalog-icons/web.svg',false),
  ('web-sistemas','One Page Profissional','one-page-profissional','PM-036','Site compacto de uma página.','Site compacto de uma página. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/web.svg',false),
  ('web-sistemas','Site Institucional Simples','site-institucional-simples','PM-037','Site profissional para presença institucional.','Site profissional para presença institucional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',450000,'/catalog-icons/web.svg',false),
  ('web-sistemas','Site Institucional Completo','site-institucional-completo','PM-038','Projeto web institucional ampliado.','Projeto web institucional ampliado. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',650000,'/catalog-icons/web.svg',false),
  ('web-sistemas','Portfólio Profissional','portfolio-profissional','PM-039','Site para apresentar trabalhos, projetos e serviços.','Site para apresentar trabalhos, projetos e serviços. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',350000,'/catalog-icons/web.svg',false),
  ('web-sistemas','Catálogo Online','catalogo-online','PM-040','Vitrine digital de produtos ou serviços.','Vitrine digital de produtos ou serviços. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',420000,'/catalog-icons/ecommerce-sistemas.svg',false),
  ('web-sistemas','Loja Virtual','loja-virtual','PM-041','E-commerce completo para vendas online.','E-commerce completo para vendas online. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',750000,'/catalog-icons/ecommerce-sistemas.svg',false),
  ('web-sistemas','Site com Blog','site-com-blog','PM-042','Site institucional com publicação de conteúdo.','Site institucional com publicação de conteúdo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',500000,'/catalog-icons/web.svg',false),
  ('web-sistemas','Portal Administrativo','portal-administrativo','PM-043','Sistema web com painel administrativo sob medida.','Sistema web com painel administrativo sob medida. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',1000000,'/catalog-icons/ecommerce-sistemas.svg',false),
  ('web-sistemas','Portal do Cliente','portal-do-cliente','PM-044','Área autenticada para relacionamento e acompanhamento.','Área autenticada para relacionamento e acompanhamento. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',900000,'/catalog-icons/ecommerce-sistemas.svg',false),
  ('web-sistemas','Dashboard de Gestão','dashboard-de-gestao','PM-045','Painel visual para indicadores e operação.','Painel visual para indicadores e operação. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',650000,'/catalog-icons/ecommerce-sistemas.svg',false),
  ('web-sistemas','Manutenção Web Mensal','manutencao-web-mensal','PM-046','Pacote mensal de ajustes e manutenção.','Pacote mensal de ajustes e manutenção. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/web.svg',false),
  ('video-audiovisual','Edição de Reel Simples','edicao-reel-simples','PM-047','Edição curta para redes sociais.','Edição curta para redes sociais. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',30000,'/catalog-icons/video.svg',false),
  ('video-audiovisual','Edição de Reel Avançado','edicao-reel-avancado','PM-048','Reel com ritmo, efeitos e tratamento ampliado.','Reel com ritmo, efeitos e tratamento ampliado. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',55000,'/catalog-icons/video.svg',false),
  ('video-audiovisual','Edição de Vídeo 3 a 5 Min','edicao-video-3-5-min','PM-049','Edição completa de vídeo curto.','Edição completa de vídeo curto. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/video.svg',false),
  ('video-audiovisual','Edição de Vídeo 15 a 30 Min','edicao-video-15-30-min','PM-050','Edição de conteúdo longo.','Edição de conteúdo longo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/video.svg',false),
  ('video-audiovisual','Vídeo Institucional Curto','video-institucional-curto','PM-051','Produção audiovisual institucional compacta.','Produção audiovisual institucional compacta. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',350000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Vídeo Corporativo Completo','video-corporativo-completo','PM-052','Produção corporativa completa.','Produção corporativa completa. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',600000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Captação Audiovisual 2 Horas','captacao-audiovisual-2h','PM-053','Captação presencial de até 2 horas.','Captação presencial de até 2 horas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',70000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Captação Audiovisual 4 Horas','captacao-audiovisual-4h','PM-054','Captação presencial de até 4 horas.','Captação presencial de até 4 horas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',110000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Diária de Captação Audiovisual','diaria-captacao-audiovisual','PM-055','Diária profissional de captação.','Diária profissional de captação. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',150000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Cobertura de Evento 2 Horas','cobertura-evento-2h','PM-056','Cobertura audiovisual compacta.','Cobertura audiovisual compacta. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Cobertura de Evento 4 Horas','cobertura-evento-4h','PM-057','Cobertura audiovisual intermediária.','Cobertura audiovisual intermediária. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Cobertura Audiovisual - Diária','cobertura-audiovisual-diaria','PM-058','Cobertura de evento em diária completa.','Cobertura de evento em diária completa. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',250000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Entrevista Gravada','entrevista-gravada','PM-059','Captação e edição de entrevista.','Captação e edição de entrevista. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Vídeo de Produto','video-de-produto','PM-060','Vídeo curto para apresentar produto ou serviço.','Vídeo curto para apresentar produto ou serviço. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/audiovisual.svg',false),
  ('video-audiovisual','Conteúdo Mobile - Meio Período','conteudo-mobile-meio-periodo','PM-061','Captação ágil com smartphone para redes.','Captação ágil com smartphone para redes. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/audiovisual.svg',false),
  ('motion-graphics','Motion Simples','motion-simples','PM-062','Animação curta para conteúdo digital.','Animação curta para conteúdo digital. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',60000,'/catalog-icons/motion.svg',false),
  ('motion-graphics','Logo Animada','logo-animada','PM-063','Animação profissional de logotipo.','Animação profissional de logotipo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/motion.svg',false),
  ('motion-graphics','Vinheta de Abertura','vinheta-abertura','PM-064','Vinheta curta para vídeos e programas.','Vinheta curta para vídeos e programas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/motion.svg',false),
  ('motion-graphics','Card Animado para Redes','card-animado-redes','PM-065','Peça animada curta para social media.','Peça animada curta para social media. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',35000,'/catalog-icons/motion.svg',false),
  ('motion-graphics','Kit Lower Thirds','kit-lower-thirds','PM-066','Pacote de identificações animadas para vídeo.','Pacote de identificações animadas para vídeo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',50000,'/catalog-icons/motion.svg',false),
  ('motion-graphics','Anúncio Animado','anuncio-animado','PM-067','Criativo animado para campanha.','Criativo animado para campanha. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/motion.svg',false),
  ('audio-musica','Edição de Áudio','edicao-de-audio','PM-068','Cortes, organização e acabamento de áudio.','Cortes, organização e acabamento de áudio. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',30000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Limpeza de Ruído','limpeza-de-ruido','PM-069','Tratamento e limpeza de gravação.','Tratamento e limpeza de gravação. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',25000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Edição de Podcast','edicao-de-podcast','PM-070','Edição completa de episódio de podcast.','Edição completa de episódio de podcast. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',45000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Mixagem','mixagem','PM-071','Mixagem musical ou de projeto de áudio.','Mixagem musical ou de projeto de áudio. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',60000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Masterização','masterizacao','PM-072','Finalização técnica para distribuição.','Finalização técnica para distribuição. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',40000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Mixagem + Masterização','mixagem-masterizacao','PM-073','Pacote completo de finalização de áudio.','Pacote completo de finalização de áudio. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Produção Musical','producao-musical','PM-074','Produção musical completa conforme briefing.','Produção musical completa conforme briefing. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',150000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Beat / Instrumental','beat-instrumental','PM-075','Produção de beat ou instrumental original.','Produção de beat ou instrumental original. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',90000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Jingle','jingle','PM-076','Peça musical curta para marca ou campanha.','Peça musical curta para marca ou campanha. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',120000,'/catalog-icons/audio.svg',false),
  ('audio-musica','Locução Editada','locucao-editada','PM-077','Tratamento e montagem de locução fornecida.','Tratamento e montagem de locução fornecida. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',35000,'/catalog-icons/audio.svg',false),
  ('dj-eventos','DJ Bar / Boate - Até 4h','dj-bar-boate-4h','PM-078','Set de DJ de até 4 horas.','Set de DJ de até 4 horas. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',80000,'/catalog-icons/dj.svg',false),
  ('dj-eventos','DJ Festa Privada - Até 4h','dj-festa-privada-4h','PM-079','Set para aniversário, confraternização ou festa privada.','Set para aniversário, confraternização ou festa privada. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',150000,'/catalog-icons/dj.svg',false),
  ('dj-eventos','DJ Evento Corporativo','dj-evento-corporativo','PM-080','Apresentação musical para evento corporativo.','Apresentação musical para evento corporativo. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',200000,'/catalog-icons/dj.svg',false),
  ('dj-eventos','DJ Casamento / Grande Evento','dj-casamento-grande-evento','PM-081','Apresentação para celebrações e grandes eventos.','Apresentação para celebrações e grandes eventos. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',280000,'/catalog-icons/dj.svg',false),
  ('comercial-institucional','Identidade para Projeto Cultural','identidade-projeto-cultural','PM-082','Identidade visual para projeto cultural ou social.','Identidade visual para projeto cultural ou social. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',250000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Comunicação Visual para Edital','comunicacao-visual-edital','PM-083','Kit visual para apresentação de projeto em edital.','Kit visual para apresentação de projeto em edital. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Relatório Visual','relatorio-visual','PM-084','Diagramação e design de relatório institucional.','Diagramação e design de relatório institucional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',180000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Kit Comunicação de Seminário','kit-comunicacao-seminario','PM-085','Identidade e peças essenciais para seminário ou encontro.','Identidade e peças essenciais para seminário ou encontro. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',150000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Campanha Institucional Completa','campanha-institucional-completa','PM-086','Planejamento visual e peças de campanha.','Planejamento visual e peças de campanha. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',500000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Comunicação Completa de Evento','comunicacao-completa-evento','PM-087','Pacote amplo de comunicação para evento.','Pacote amplo de comunicação para evento. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',450000,'/catalog-icons/institucional.svg',false),
  ('comercial-institucional','Direção e Desenvolvimento Documental','direcao-desenvolvimento-documental','PM-088','Desenvolvimento criativo de projeto documental.','Desenvolvimento criativo de projeto documental. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',750000,'/catalog-icons/audiovisual.svg',false),
  ('comercial-institucional','Portal de Pesquisa / Institucional','portal-pesquisa-institucional','PM-089','Portal web para pesquisa, relatório ou projeto institucional.','Portal web para pesquisa, relatório ou projeto institucional. Inclui briefing, execução e até 2 rodadas de ajustes dentro do escopo descrito.',850000,'/catalog-icons/ecommerce-sistemas.svg',false)
)
insert into public.products(
  name,slug,sku,short_description,description,category_id,
  product_type,commercial_mode,sale_price,promotional_price,rental_daily_price,
  stock,inventory_tracked,featured,active,status,specifications
)
select
  s.name,s.slug,s.sku,s.short_description,s.description,c.id,
  'package','sale',s.sale_price,null,null,
  1,false,s.featured,true,'published',
  jsonb_build_object(
    'catalog_kind','service',
    'cover_asset',s.cover_asset,
    'pricing_reference','preco-alvo-2026',
    'billing_label','preco-fechado',
    'revisions','ate 2 rodadas',
    'requires_briefing','true'
  )
from seed s
join public.product_categories c on c.slug=s.category_slug
on conflict(slug) do nothing;

create or replace function public.create_product_order(p_product_id uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare p public.products%rowtype; oid uuid; amount integer;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='customer' and status='active') then
    raise exception 'Customer access required' using errcode='42501';
  end if;
  select * into p from public.products where id=p_product_id and active and status='published';
  if not found or p.commercial_mode not in ('sale','sale_and_rental') or p.sale_price is null then
    raise exception 'Product unavailable' using errcode='22023';
  end if;
  if p.inventory_tracked and p.stock <= 0 then
    raise exception 'Product out of stock' using errcode='22023';
  end if;
  amount := coalesce(p.promotional_price,p.sale_price);
  insert into public.orders(customer_id,status,payment_status,subtotal,total)
  values(auth.uid(),'awaiting_payment','pending',amount,amount) returning id into oid;
  insert into public.order_items(order_id,item_type,product_id,name_snapshot,quantity,unit_price,total_price,metadata)
  values(oid,'product',p.id,p.name,1,amount,amount,jsonb_build_object('catalog_kind',coalesce(p.specifications->>'catalog_kind','product')));
  insert into public.payments(customer_id,order_id,amount,method,status,provider)
  values(auth.uid(),oid,amount,'pix_manual','pending','manual');
  return oid;
end $$;

revoke all on function public.create_product_order(uuid) from public;
grant execute on function public.create_product_order(uuid) to authenticated;

create or replace function public.create_cart_order(p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  p public.products%rowtype;
  qty integer;
  unit_amount integer;
  line_total integer;
  order_total integer := 0;
  order_uuid uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer' and status = 'active'
  ) then
    raise exception 'Customer access required' using errcode = '42501';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart' using errcode = '22023';
  end if;

  insert into public.orders(customer_id,status,payment_status,subtotal,total)
  values(auth.uid(),'awaiting_payment','pending',0,0)
  returning id into order_uuid;

  for item in select value from jsonb_array_elements(p_items)
  loop
    begin
      qty := (item->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid quantity' using errcode = '22023';
    end;

    if qty is null or qty < 1 or qty > 99 then
      raise exception 'Invalid quantity' using errcode = '22023';
    end if;

    select * into p
    from public.products
    where id = (item->>'product_id')::uuid
      and active = true
      and status = 'published'
      and commercial_mode in ('sale','sale_and_rental')
      and sale_price is not null
    for update;

    if not found then
      raise exception 'Product unavailable' using errcode = '22023';
    end if;

    if p.inventory_tracked and p.stock < qty then
      raise exception 'Insufficient stock for %', p.name using errcode = '22023';
    end if;

    unit_amount := coalesce(p.promotional_price,p.sale_price);
    line_total := unit_amount * qty;
    order_total := order_total + line_total;

    insert into public.order_items(
      order_id,item_type,product_id,name_snapshot,quantity,unit_price,total_price,metadata
    ) values (
      order_uuid,'product',p.id,p.name,qty,unit_amount,line_total,
      jsonb_build_object('catalog_kind',coalesce(p.specifications->>'catalog_kind','product'))
    );

    if p.inventory_tracked then
      update public.products set stock = stock - qty where id = p.id;
    end if;
  end loop;

  update public.orders
  set subtotal = order_total, total = order_total
  where id = order_uuid;

  insert into public.payments(customer_id,order_id,amount,method,status,provider)
  values(auth.uid(),order_uuid,order_total,'pix_manual','pending','manual');

  insert into public.notifications(user_id,type,title,message,link,metadata)
    select id,'order_created','Novo pedido',
      'Um cliente realizou um novo pedido.',
      '/admin/pedidos/'||order_uuid::text,
      jsonb_build_object('order_id',order_uuid)
    from public.profiles
    where role in ('admin','staff') and status='active';

  return order_uuid;
end
$$;

revoke all on function public.create_cart_order(jsonb) from public;
grant execute on function public.create_cart_order(jsonb) to authenticated;
