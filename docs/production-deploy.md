# Produção — Play Moments

Ambiente oficial:

- Cloudflare Workers
- Worker: `playsistem-oficial`
- URL: `https://playsistem-oficial.playmomentsstudios.workers.dev/`
- Branch de produção: `main`

## Fluxo de publicação

1. Alterações entram por Pull Request.
2. O workflow `CI` valida typecheck, testes, build e diff.
3. Depois do merge na `main`, o CI da `main` precisa concluir com sucesso.
4. `Deploy production` usa exatamente o SHA validado e publica o diretório `dist` no Cloudflare Workers via Wrangler.
5. O histórico de versões do Cloudflare deve avançar para o commit mais recente da `main`.

## Configuração necessária no GitHub

Secrets do ambiente/repositório:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nenhuma credencial deve ser gravada no repositório.

## Marco de sincronização

PR #158 foi criado para disparar e validar o primeiro ciclo completo do novo fluxo de produção após a automação adicionada no PR #157.
