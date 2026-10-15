-- SAGA NEGRA Release 07 — rollout, preserving the author's Drive originals.
-- Public landing presents the work; paid PDF/MP3 require separate per-customer grants.
-- Use the shared original file ids for compatibility with the existing
-- academy-library-media OAuth fallback. Private institutional backups exist
-- separately and must not be used as playable sources without a working OAuth
-- authorization test.
DO $release07$
DECLARE
 v_admin uuid;
 v_landing uuid;
 v_work uuid;
 v_title text := 'SAGA NEGRA — A Mulher Negra e o Direito de Ser Completa';
 v_image text := 'https://drive.google.com/thumbnail?id=1D-c4sBknqz46dl5lpVFyS_9cMFY6gkuv&sz=w1200';
 v_desc text := $description$Toda mulher tem o direito de ser mais do que a força que o mundo espera dela.

Na SAGA NEGRA — Release 07, a história encontra o presente para questionar uma cobrança antiga: por que mulheres negras precisam provar resistência antes de receber cuidado, respeito e liberdade? Entre memória, trabalho, saúde, afeto, cultura, proteção e tecnologia, a obra reflete sobre escolhas reais e condições concretas para viver por inteiro.

Uma leitura que reconhece coragem sem transformá-la em obrigação — e defende dignidade sem exigir heroísmo.$description$;
 v_sample text := $excerpt$Nenhuma mulher deveria ser definida apenas pela força que precisou demonstrar. Quando uma mulher negra é chamada de guerreira, a palavra pode reconhecer uma história de coragem. Mas também pode esconder uma cobrança injusta: a de suportar tudo, resolver tudo e nunca demonstrar cansaço. Ser completa é ter o direito de existir para além dessa expectativa.

A mulher negra não é uma personagem única. Há mulheres de diferentes idades, regiões, rendas, religiões, identidades e projetos de vida. Algumas são mães; outras não desejam a maternidade. Algumas lideram empresas, coletivos ou famílias; outras buscam uma vida reservada. A história negra precisa acolher essa diversidade, em vez de trocar um estereótipo por outro.

Este capítulo percorre a história, o trabalho, o cuidado, a saúde, a representação e a liberdade de escolha. Seu ponto de partida é simples: dignidade não depende de heroísmo. Uma sociedade justa não exige que alguém prove sua resistência para merecer proteção e respeito.$excerpt$;
 v_sections jsonb;
BEGIN
 SELECT id INTO v_admin FROM public.profiles
  WHERE role='admin' AND status='active' ORDER BY created_at LIMIT 1;
 IF v_admin IS NULL THEN
  RAISE NOTICE 'Release 07 publishing skipped: no active administrative profile in fixture.';
  RETURN;
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 v_sections:=jsonb_build_array(
  jsonb_build_object('type','benefits','title','Para além da obrigação de ser forte',
   'items',jsonb_build_array(
    jsonb_build_object('title','Força não é obrigação','description','Entenda como a ideia da mulher negra sempre guerreira pode ocultar o direito ao descanso, ao afeto e a ser cuidada.'),
    jsonb_build_object('title','História contada com protagonismo','description','Da memória do trabalho às vozes de Carolina Maria de Jesus, Lélia Gonzalez e Sueli Carneiro: experiências, ideias e transformações.'),
    jsonb_build_object('title','O tempo também pertence a ela','description','Trabalho, remuneração, cuidado doméstico e tempo livre são temas essenciais para uma vida com autonomia.'),
    jsonb_build_object('title','Corpo, saúde e respeito','description','O direito a serviços de saúde, acolhimento, informação e proteção sem estereótipos nem negligência.'),
    jsonb_build_object('title','Afeto e liberdade de escolha','description','Amar, não amar, ser mãe ou não, construir projetos próprios: não existe um único modo legítimo de ser mulher negra.'),
    jsonb_build_object('title','Tecnologia, presença e futuro','description','Da representação na cultura à economia digital, a obra pergunta o que precisa mudar para que novas possibilidades sejam comuns.')
   )),
  jsonb_build_object('type','content','title','Uma jornada de história, direitos e possibilidades',
   'items',jsonb_build_array(
    jsonb_build_object('title','Memória, trabalho e resistência','description','Iniciativa, redes de cuidado e desigualdades ao longo da história brasileira.'),
    jsonb_build_object('title','Vozes que transformaram o debate','description','A produção intelectual e cultural de mulheres negras como parte central da nossa história.'),
    jsonb_build_object('title','Trabalho, renda e tempo de vida','description','O valor do trabalho visível e invisível e o direito de ter tempo para si.'),
    jsonb_build_object('title','Corpo, saúde e direito ao cuidado','description','Respeito no atendimento, saúde mental, maternidade e proteção social.'),
    jsonb_build_object('title','Afeto, imagem e liberdade','description','Representação, relações, identidade e o direito de escolher caminhos diferentes.'),
    jsonb_build_object('title','Violência, tecnologia e caminhos de mudança','description','Proteção concreta, voz na vida pública, economia digital e direitos para o futuro.')
   )),
  jsonb_build_object('type','faq','title','Perguntas frequentes',
   'items',jsonb_build_array(
    jsonb_build_object('title','Posso escolher apenas o e-book?','description','Sim. Você pode pedir somente a versão de leitura em PDF, somente o audiobook ou o combo com os dois formatos.'),
    jsonb_build_object('title','Preciso de uma conta para pedir informações?','description','Não. Escolha o formato e deixe seu contato. A equipe apresentará as condições de aquisição antes de qualquer cobrança.'),
    jsonb_build_object('title','Como recebo o acesso depois da compra?','description','Após a confirmação e a liberação pela equipe, a obra aparece na sua biblioteca pessoal da Academia Sagamente.'),
    jsonb_build_object('title','Posso conhecer a obra antes de adquirir?','description','Sim. Esta página oferece uma amostra de leitura. O arquivo integral permanece reservado aos clientes autorizados.')
   ))
 );
 INSERT INTO public.site_landing_pages(
  title,slug,status,eyebrow,headline,subheadline,cta_label,cta_href,
  secondary_cta_label,secondary_cta_href,hero_image_url,hero_image_drive_file_id,
  hero_image_mime_type,hero_image_file_size,sections,seo_title,seo_description,
  noindex,published_at,created_by,updated_by
 ) VALUES (
  v_title,'biblioteca-saga-negra-07-mulher-negra-completa','draft',
  'SAGA NEGRA · Release 07',
  'Ela não nasceu para aguentar tudo. Nasceu para viver por inteiro.',
  'Uma reflexão sobre o direito da mulher negra de existir para além da resistência: ser ouvida, amada, protegida, respeitada e livre para construir a própria história.',
  'Quero adquirir','/academia/interesse/07',
  'Ler uma amostra','#amostras',v_image,'1D-c4sBknqz46dl5lpVFyS_9cMFY6gkuv',
  'image/png',1778444,v_sections,
  'A Mulher Negra e o Direito de Ser Completa | SAGA NEGRA — Release 07',
  'A mulher negra merece ser mais do que forte. Descubra uma obra sobre história, cuidado, afeto e direitos. Leia uma amostra e escolha e-book, audiobook ou combo.',
  true,null,v_admin,v_admin
 )
 ON CONFLICT (slug) DO NOTHING;
 SELECT id INTO v_landing FROM public.site_landing_pages
 WHERE slug='biblioteca-saga-negra-07-mulher-negra-completa';
 IF v_landing IS NULL THEN RAISE EXCEPTION 'Could not locate Release 07 landing'; END IF;
 INSERT INTO public.academy_library_works(release_code,title,slug,description,cover_url,landing_page_id)
 VALUES('07',v_title,'saga-negra-release-07',v_desc,v_image,v_landing)
 ON CONFLICT (release_code) DO NOTHING;
 SELECT id INTO v_work FROM public.academy_library_works WHERE release_code='07';
 IF v_work IS NULL THEN RAISE EXCEPTION 'Could not create Release 07 work'; END IF;
 INSERT INTO public.academy_library_items(
  release_code,format,title,slug,drive_file_id,source_filename,mime_type,
  status,description,cover_url,cover_drive_file_id,sample_text,landing_page_id,work_id
 )
 VALUES
 ('07','ebook',v_title,'saga-negra-07-ebook',
  '1DTPWYWGe70Qrz4MkRu-bcHodaek-DTZc',
  'SAGA NEGRA - A Mulher Negra e o Direito de Ser Completa (Ebook).pdf',
  'application/pdf','published',v_desc,v_image,'1D-c4sBknqz46dl5lpVFyS_9cMFY6gkuv',
  v_sample,v_landing,v_work),
 ('07','audiobook',v_title,'saga-negra-07-audiobook',
  '1UdmWYPb7M6pDFm_2DFbYEB0541RYMM2F',
  'SAGA NEGRA - A Mulher Negra e o Direito de Ser Completa (Audiobook).mp3',
  'audio/mpeg','published',v_desc,v_image,'1D-c4sBknqz46dl5lpVFyS_9cMFY6gkuv',
  null,v_landing,v_work)
 ON CONFLICT (release_code,format) DO NOTHING;
 IF (SELECT count(*) FROM public.academy_library_items WHERE release_code='07'
  AND status='published' AND work_id=v_work)=2 THEN
  UPDATE public.site_landing_pages SET
   status='published',noindex=false,published_at=coalesce(published_at,now()),updated_at=now()
  WHERE id=v_landing;
  RAISE NOTICE 'Release 07 published with ebook and audiobook.';
 ELSE
  RAISE EXCEPTION 'Incomplete Release 07 registration; landing remains draft.';
 END IF;
END $release07$;
