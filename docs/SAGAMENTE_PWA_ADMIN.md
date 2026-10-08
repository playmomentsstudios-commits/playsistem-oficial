# SAGAMENTE — Configuração de aplicativo (PWA)

## Onde configurar
Painel administrativo > Configurações do Site > Aplicativo (PWA).
Os campos de logo geral permanecem em Identidade da Marca.

## O que é editável
- Nome completo, nome curto, descrição, cor do tema e cor de fundo.
- Ícone único PNG, JPEG ou WebP, quadrado, dimensão mínima 512 × 512.
- O navegador gera arquivos PNG 180, 192, 512 e máscara 512, guardados no Google Drive, seção BRAND.
- Banco registra só os IDs no public.pwa_settings (RLS: select público, update admin mestre).

## Como funciona na produção Cloudflare
- A nova camada worker/pwa.js roda SOMENTE nas rotas do manifesto, ícones e páginas / e /instalar.
- Lê metadados públicos do Supabase com a chave pública ANON, sem usar service_role.
- /manifest.webmanifest usa nomes/cores/ícones versionados pelo updated_at.
- /pwa/icon-* faz proxy apenas dos arquivos PNG enviados ao Drive e classificados como site-public-asset.
- HTML de / e /instalar recebe apple-touch-icon versionado e título atualizado.
- Falhas no banco/Drive retornam o manifesto/ícones padrão do repositório.
- As outras rotas continuam como assets estáticos do Cloudflare.

## Efeito no iPhone e instalações existentes
Depois de publicar mudanças, as novas instalações utilizam o novo ícone.
Instalações iOS antigas podem manter o ícone em cache: remover da tela de início e adicionar novamente.
Chromium pode solicitar aprovação para atualizar informações do app instalado.
A origem/dominio HTTPS define a identidade da instalação.

## Requisitos de implantação
1. Aplicar a migration no Supabase conectado ao Sagamente.
2. PR -> CI com typecheck/test/build.
3. Merge em main, validar CI e deploy automático Cloudflare.
4. Conferir manifesto, headers, PNG e UI no domínio de produção HTTPS.
5. Verificar instalação no iPhone e Android com upload real da marca.
6. Netlify não usa o Worker Cloudflare; o pacote padrão continuará como fallback nesse ambiente.

## Segurança
Nunca guardar tokens Supabase/Drive na manifestação, cache ou upload público.
Upload via função existente autenticada (admin) e sem arquivos binários no Postgres.
