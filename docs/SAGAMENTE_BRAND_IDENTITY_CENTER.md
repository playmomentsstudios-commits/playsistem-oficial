# Gestão do Site → Identidade da Marca

Único local de personalização das sete variantes visuais: logo horizontal em fundo escuro, em fundo claro, compacta, símbolo, logo dos colaboradores, favicon e imagem de compartilhamento.

### Armazenamento
Os SVG/PNG/WebP são enviados ao Drive institucional na seção BRAND usando a função existente de upload, e o banco site_settings mantém apenas as URLs. O histórico dos arquivos é preservado. O favicon e a logo da equipe são migrados do app_settings, cujo schema permanece intacto para compatibilidade.

### Regras de aplicação
Componentes usam BrandImage para aplicar a variante apropriada. Na área do cliente recolhida o símbolo substitui a marca horizontal. Alteração na aba atualiza os consumidores via evento. Os componentes têm fallback para as logos SVG estáticas do repositório. Só Admin Mestre acessa as ações de upload porque a função de upload exige role admin, mesmo que site.manage habilite navegação.

### SEO e PDFs
Imagem social é usada como fallback apenas quando a página não tem sua própria imagem; currículos e conteúdos com imagens específicas mantêm precedência. Certificados já emitidos e documentos históricos não são alterados nesta entrega.

### Segurança
Não renomear chaves Drive playMoments*, buckets, OAuth, tabelas, ambientes de deploy ou URLs históricas. Não modificar a paleta das cores de erro.
