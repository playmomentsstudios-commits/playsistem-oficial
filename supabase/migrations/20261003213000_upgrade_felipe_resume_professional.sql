-- Reforça o minicurrículo de Felipe para leitura profissional/recrutamento.
update public.resumes
set
  summary = 'Designer e comunicador com atuação desde 2008 em identidade visual, design gráfico, editorial, digital e web. Desenvolvo projetos que conectam estratégia visual, comunicação e experiência digital, com atuação também em audiovisual e comunicação territorial. Minha trajetória reúne projetos institucionais, culturais, comunitários e iniciativas ligadas ao território quilombola Kalunga.',
  skills = '["Identidade visual","Design gráfico","Design editorial","Direção de arte","Webdesign","Comunicação digital","Audiovisual","Comunicação comunitária","Visualização territorial"]'::jsonb,
  extra_sections = '[
    {
      "title":"Ferramentas & tecnologias",
      "items":["Figma","Adobe Photoshop","Adobe Illustrator","Adobe Premiere Pro","After Effects","DaVinci Resolve","WordPress","HTML/CSS","React","IA aplicada à criação"]
    }
  ]'::jsonb,
  updated_at = now()
where slug = 'felipe-costa-designer-quilombola';
