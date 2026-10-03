-- Atualiza as participações e projetos selecionados do minicurrículo público de Felipe Costa.
-- Seguro para reexecução: altera apenas o currículo identificado pelo slug público.

update public.resumes
set
  experience = '[
    {
      "title":"Instituto Sumaúma — Pesquisa Quilombola",
      "role":"Design editorial e webdesign",
      "description":"Diagramação editorial da pesquisa e desenvolvimento da experiência digital, com organização visual de conteúdos, dados, narrativas e mapa interativo."
    },
    {
      "title":"Vão do Moleque — Painéis e comunicação territorial",
      "role":"Design gráfico e comunicação visual",
      "description":"Desenvolvimento dos painéis visuais dedicados ao Vão do Moleque, articulando território, memória, identidade quilombola e narrativa visual em uma composição voltada à valorização da comunidade."
    },
    {
      "title":"Afrocena — Identidade visual",
      "role":"Branding e direção visual",
      "description":"Desenvolvimento da identidade visual da Afrocena, construindo uma linguagem gráfica conectada à cultura negra, expressão artística e representatividade, com desdobramentos da marca em diferentes peças de comunicação."
    },
    {
      "title":"Rede Kalunga Comunicações",
      "role":"Design e comunicação territorial",
      "description":"Criação de materiais gráficos e digitais para projetos, organizações e iniciativas comunitárias, com atuação voltada à comunicação produzida a partir dos próprios territórios."
    },
    {
      "title":"Território Kalunga — Projetos comunitários",
      "role":"Design social e comunicação",
      "description":"Desenvolvimento de identidades, materiais para oficinas, ações culturais e projetos comunitários ligados à valorização da identidade e do território Kalunga."
    },
    {
      "title":"Agroindústria AKCE",
      "role":"Identidade visual e comunicação",
      "description":"Desenvolvimento de soluções de identidade e comunicação visual para iniciativa produtiva vinculada ao território."
    }
  ]'::jsonb,
  updated_at = now()
where slug = 'felipe-costa-designer-quilombola';
