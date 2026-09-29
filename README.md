# Play Moments Platform

Ecossistema digital Play Moments: site público, catálogo de produtos e serviços, checkout/pagamentos, portal do cliente, projetos e arquivos no Google Drive, CRM, colaboradores e Academia.

## Stack

- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind CSS v4
- **Backend:** Supabase Postgres + Auth + RLS + Edge Functions (Deno)
- **Arquivos:** Google Drive para mídia/arquivos pesados; Supabase para metadados e regras
- **Pagamentos:** Asaas
- **Deploy:** Netlify / Cloudflare conforme os componentes do projeto

## Princípios

- Supabase Auth é a autenticação oficial.
- RLS/RBAC protegem dados e permissões no banco; a UI não é a barreira de segurança.
- Valores comerciais críticos são validados no servidor/banco.
- Arquivos pesados priorizam Google Drive.
- Não existe autenticação demo nem backend Hono/KV ativo no código atual.

## Requisitos e comandos

- Node.js 22.22.0
- pnpm 10.30.3
- `pnpm install`
- `pnpm dev`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

Variáveis públicas usam prefixo `VITE_`. Nunca coloque segredos privados em variáveis `VITE_`.

## Áreas

- `/`: experiência pública
- `/produtos`: catálogo
- `/servicos`: serviços
- `/academia`: Academia pública
- `/l/:slug`: landing pages
- `/app/*`: portal autenticado do cliente
- `/admin/*`: operação Admin Master/colaboradores com RBAC

## Infraestrutura

Migrations ficam em `supabase/migrations/` e Edge Functions em `supabase/functions/`.
O deploy do frontend não publica automaticamente Edge Functions. Mudanças em funções Supabase devem ser implantadas explicitamente no projeto correspondente.

Consulte `docs/` para registros de arquitetura, homologação e fases da V1.
