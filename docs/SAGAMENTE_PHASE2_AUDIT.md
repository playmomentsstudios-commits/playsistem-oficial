# Checklist técnico — Auditoria SAGAMENTE (fase 2)

## Corrigido no código
- Páginas públicas e fluxo de autenticação, incluindo senha e confirmação por e-mail.
- Cabeçalhos, textos, SEO estruturado, títulos, certificados/validação, capa acadêmica, páginas de serviços/produtos, suporte e biblioteca de arquivos.
- Tokens de interface institucional e hover, mantendo vermelhos de erro, exclusão e segurança.
- Identidade do colaborador: arquivo /staff-logo.svg substituído pelo logotipo claro sobre fundo branco.
- Novas descrições de pagamentos Asaas e criador de PDF; funções terão que ser implantadas separadamente.

## SQL pronto, NÃO executado
`supabase/migrations/20261008043000_sagamente_institutional_branding.sql` atualiza CMS, nome de negócio, respostas de autoatendimento, templates de certificados futuros e frases de notificação em três funções. Execute **somente após** deploy principal do frontend.

## Preservado intencionalmente
- `playmoments.*` em localStorage, appProperties de Drive e constantes de compatibilidade.
- Asaas, pagamentos passados, links de certificados emitidos e históricos.
- URLs atuais de Cloudflare/Netlify, OAuth, e-mail de login, webhook, PDF e site oficial até controle efetivo do domínio.
- Drive: o identificador raiz e o nome físico PLAY MOMENTS não devem divergir; migre-os com a conta institucional depois.
- Não atualizar depoimentos, metadados de obras antigas, currículo pessoal ou históricos de cliente por substituição genérica.

## Dependência de produção
O workflow `.github/workflows/deploy-production.yml` não encontrou `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O CI de frontend pode passar sem publicar no site oficial. Revalidar checkout, upload de arquivos, progresso de tarefas, Academia, acesso do cliente e painel colaborador na URL real após restabelecer secrets. Só então sincronizar o Supabase.

## Segurança do rollout
Branch → PR → CI → deploy → checagem de frontend → migration SQL → edge functions atualizadas → checagens de correio/pagamentos.
