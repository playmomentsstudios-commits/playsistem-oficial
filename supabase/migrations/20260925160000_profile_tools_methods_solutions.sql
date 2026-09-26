-- Replace public employer history with tools, methods and executed solutions.
alter table public.site_profile
  add column if not exists tools jsonb not null default '[]'::jsonb,
  add column if not exists methods jsonb not null default '[]'::jsonb,
  add column if not exists solutions jsonb not null default '[]'::jsonb;

update public.site_profile
set
  tools = '[
    {"group":"Design & Criação","items":["Adobe Photoshop","Adobe Illustrator","Figma"]},
    {"group":"Vídeo & Conteúdo","items":["DaVinci Resolve","CapCut","edição e finalização audiovisual"]},
    {"group":"Web & Desenvolvimento","items":["React","Next.js","Vite","Tailwind CSS","Bootstrap","Node.js"]},
    {"group":"Backend & Dados","items":["Supabase","PostgreSQL","Auth","RLS","Storage"]},
    {"group":"Infra & Publicação","items":["GitHub","GitHub Codespaces","Cloudflare","Netlify","WordPress","Astra"]},
    {"group":"Automação & Integração","items":["n8n","Make","APIs","webhooks"]},
    {"group":"Mapas & Geodados","items":["Leaflet","OpenStreetMap","QGIS"]}
  ]'::jsonb,
  methods = '[
    {"title":"Briefing e diagnóstico","description":"Entendimento do objetivo, público, contexto, referências e restrições antes de produzir."},
    {"title":"Estrutura e prototipação","description":"Organização de fluxo, arquitetura, wireframe, conceito visual ou estrutura de conteúdo antes da execução final."},
    {"title":"Execução por etapas","description":"Produção dividida em blocos menores, com validação do que é crítico antes de avançar para a próxima fase."},
    {"title":"Teste e refinamento","description":"Revisão visual, técnica e funcional em desktop e mobile, corrigindo inconsistências antes da entrega."},
    {"title":"Entrega organizada","description":"Arquivos, versões, links, documentação e materiais finais preparados para continuidade e manutenção."}
  ]'::jsonb,
  solutions = '[
    {"title":"Identidade visual e campanhas","description":"Logotipos, sistemas visuais, materiais promocionais, social media, peças para eventos e comunicação institucional."},
    {"title":"Sites, portais e sistemas","description":"Landing pages, sites institucionais, lojas, portais de pesquisa, painéis administrativos e áreas de cliente."},
    {"title":"Audiovisual e conteúdo","description":"Captação, edição, reels, vídeos institucionais, entrevistas, cobertura de eventos e conteúdos para redes."},
    {"title":"Fluxos internos e produtividade","description":"Painéis, calendários, tarefas, arquivos, notificações, permissões, relatórios e organização de processos."},
    {"title":"Automação e integrações","description":"Integrações com APIs, pagamentos, Google Drive, Supabase, webhooks e automações operacionais."},
    {"title":"Comunicação cultural e territorial","description":"Projetos digitais, materiais gráficos, mapas, relatórios e comunicação voltada a iniciativas culturais e comunitárias."}
  ]'::jsonb,
  updated_at = now()
where id = true;
