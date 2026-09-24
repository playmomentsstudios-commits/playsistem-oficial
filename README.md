# Play Moments Platform

Plataforma web completa para relacionamento com clientes — site público, portal do cliente e painel administrativo.

## Stack

- **Frontend**: React 19 + Vite 8 + TypeScript + Tailwind CSS v4
- **Backend**: Supabase Edge Functions (Deno + Hono)
- **Banco**: Supabase KV Store (Postgres via Supabase)
- **Auth**: JWT (sign/verify via Hono JWT)

## Requisitos

- Node.js 22.22.0 (fixado em `.nvmrc` e `netlify.toml`).
- pnpm 10.30.3 (fixado em `package.json`).
- O frontend funciona fora do Figma Make.

## Instalação

```bash
pnpm install
```

## Desenvolvimento

```bash
pnpm dev
```

O servidor sobe em `http://localhost:8443`.

## Variáveis de ambiente

Crie um arquivo `.env.local` baseado em `.env.example`:

```bash
cp .env.example .env.local
```

## Build para produção

```bash
pnpm build
```

## Credenciais demo (sem backend)

| Usuário | Email | Senha |
|---------|-------|-------|
| Admin | admin@playmoments.com.br | admin123 |
| Cliente | cliente@exemplo.com | cliente123 |

## Estrutura de rotas

| Rota | Descrição |
|------|-----------|
| `/` | Home |
| `/produtos` | Produtos e equipamentos |
| `/servicos` | Serviços |
| `/portfolio` | Portfólio |
| `/comunidade` | Mural/comunidade |
| `/login` | Login |
| `/cadastro` | Cadastro |
| `/app/*` | Portal do cliente (autenticado) |
| `/admin/*` | Painel administrativo (admin/staff) |

## Netlify

Conecte este repositório e selecione a branch a publicar. O arquivo `netlify.toml`
configura `pnpm build`, saída `dist`, Node 22.22.0 e pnpm 10.30.3.
O rewrite SPA permite abrir diretamente rotas como `/admin` e `/app/dashboard`.

`VITE_API_URL` é a única variável de integração consumida pelo frontend atual.
Deixe-a vazia enquanto o backend é padronizado: o cliente continuará usando `/api`,
mas não há proxy de API nesta etapa. O build não exige essa variável preenchida.
Não coloque credenciais privadas em variáveis `VITE_`.

Esta configuração publica somente o frontend. Autenticação demo, dados locais e
backend Supabase permanecem como estão; o deploy frontend não os torna operacionais.
