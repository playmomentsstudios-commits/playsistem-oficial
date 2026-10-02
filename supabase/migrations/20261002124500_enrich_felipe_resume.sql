-- Enrich Felipe Costa's public mini resume with structured territorial experience.
-- Safe to re-run: updates only the known public resume slug.

update public.resumes
set
  eyebrow = 'Minicurrículo · Design, território & comunicação',
  summary = 'Sou Felipe Costa Souza, designer e comunicador quilombola Kalunga, natural de Cavalcante (GO). Atuo com design e comunicação visual desde 2008, desenvolvendo trabalhos em identidade visual, design gráfico, comunicação digital, audiovisual e web. Minha trajetória profissional cresceu junto da minha participação no território Kalunga e de experiências de comunicação ligadas à cultura, ao desenvolvimento local e à valorização das narrativas quilombolas.',
  identity_text = 'Minha trajetória no design também foi construída a partir do território e das experiências quilombolas. Ao longo dos anos, participei da criação de identidades visuais, peças de comunicação e materiais para oficinas, projetos culturais, iniciativas comunitárias, agricultura familiar e ações de valorização do território Kalunga.

Também atuei em projetos quilombolas para além do território Kalunga. No Instituto Sumaúma, participei da comunicação visual de uma pesquisa sobre corpos territoriais quilombolas, sendo responsável pela diagramação da pesquisa e pelo webdesign de um mapa interativo, transformando dados, narrativas e informações territoriais em uma experiência visual e digital.

Faço parte ainda de uma rede de comunicadores comunitários, contribuindo para a produção e circulação de narrativas construídas a partir das próprias comunidades. Essa vivência faz com que meu trabalho não parta apenas de referências estéticas sobre o universo quilombola, mas de participação, escuta, experiência territorial e compromisso com a forma como nossas identidades são representadas.',
  skills = '["Identidade visual","Design gráfico","Design editorial","Direção de arte","Webdesign","Comunicação comunitária","Audiovisual","Visualização territorial"]'::jsonb,
  experience = '[
    {
      "title":"Território Kalunga — identidades e comunicação comunitária",
      "role":"Designer e comunicador",
      "description":"Criação de identidades visuais, peças e materiais para oficinas, projetos culturais, ações comunitárias e iniciativas ligadas ao desenvolvimento local e à valorização do território."
    },
    {
      "title":"Agricultura familiar, KCE, Vão do Moleque e Frosena",
      "role":"Identidade visual e comunicação",
      "description":"Desenvolvimento de soluções visuais para iniciativas ligadas ao território, à organização comunitária e à circulação de informação."
    },
    {
      "title":"Instituto Sumaúma — pesquisa quilombola",
      "role":"Diagramação e webdesign",
      "description":"Diagramação de pesquisa sobre corpos territoriais quilombolas e elaboração do webdesign de um mapa interativo para apresentar dados, narrativas e informações territoriais."
    },
    {
      "title":"Rede de comunicadores comunitários",
      "role":"Comunicação territorial",
      "description":"Participação em rede de comunicadores voltada à produção e circulação de narrativas construídas a partir das próprias comunidades."
    }
  ]'::jsonb,
  seo_description = 'Minicurrículo de Felipe Costa Souza, designer e comunicador quilombola Kalunga com atuação em identidade visual, comunicação comunitária, design editorial, webdesign e audiovisual desde 2008.',
  updated_at = now()
where slug = 'felipe-costa-designer-quilombola';
