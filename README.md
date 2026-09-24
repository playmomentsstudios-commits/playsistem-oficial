# Play Moments Platform

Plataforma web completa para relacionamento com clientes — site público, portal do cliente e painel administrativo.

## Stack

- **Frontend**: React 19 + Vite 8 + TypeScript + Tailwind CSS v4
- **Backend**: Supabase Edge Functions (Deno + Hono)
- **Banco**: Supabase KV Store (Postgres via Supabase)
- **Auth**: JWT (sign/verify via Hono JWT)

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
