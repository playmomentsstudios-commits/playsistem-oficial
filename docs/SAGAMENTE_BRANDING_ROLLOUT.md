# Sagamente — implantação visual

Identidade: **SAGAMENTE**; assinatura **Design · Tecnologia · Comunicação**. Cores: terra `#A65A2A`, carvão `#0E0E0E`, areia `#E7E1D7`, verde nativo `#2E5D46`, bronze `#C48A3A`.

Esta etapa muda interfaces, logotipo e SEO visível. Mantém rotas, dados históricos, Catálogo, pedidos, pagamentos, autenticação, CRM, Drive, Supabase e identificadores internos.

## Verificação antes de produção

1. Executar testes e build.
2. Verificar mobile/desktop: home, login, cadastro, carrinho/checkout, Academia, administrador, colaborador, arquivos do cliente.
3. Site CMS ainda pode conter textos e cor vermelha no banco; sincronizar `site_settings` / `app_settings` após validação das mudanças. Preservar conteúdos históricos.
4. Não renomear repositório, banco, storage, buckets, pastas Drive, URLs de callbacks, Asaas, OAuth ou domínio atual nesta etapa.
5. Validar INPI e aquisição do domínio antes de mudar DNS, canonical e URLs institucionais. Preparar rollback.
