# Sagamente — PWA instalável V1

## Arquitetura
Aplicativo instalável gratuito aproveitando o mesmo React/Vite, Supabase Auth/Postgres, Asaas e Google Drive do Sagamente. Não exige duplicação ou migração de dados.

## Entrega
- Manifest com identidade, ícones, atalhos e modo standalone.
- PNG 180/192/512 e máscara Android gerados do símbolo SVG institucional por script sem dependências externas.
- Service worker com cache restrito a assets públicos versionados, e aviso offline neutro.
- Página /instalar com prompt nativo quando disponível e instruções por plataforma.
- Registro do service worker apenas na versão de produção.

## Regras de segurança
Não cachear HTML, /admin, /app, checkout, Supabase Auth/REST, URLs assinadas, Google Drive, arquivos de cliente ou pagamentos. O aplicativo depende de conexão para acessar dados pessoais e operações.

## Homologação
1. Executar pnpm install --frozen-lockfile, pnpm typecheck, pnpm test e pnpm build.
2. Testar /manifest.webmanifest, /sw.js e /pwa/icon-*.png em HTTPS, todos com status 200 e MIME correto.
3. Conferir Chrome DevTools > Application > Manifest e Service Workers.
4. Validar instalação Android/Chrome, Windows/Chrome ou Edge e iPhone via Compartilhar.
5. Testar login, recuperação de senha, links, uploads Drive, projetos e pagamentos.
6. Testar offline em /admin e /app: só deve aparecer o aviso neutro.
7. Publicar pela cadeia PR > CI > main > CI > Cloudflare; confirmar o endereço HTTPS de produção.

## Domínio
Instalação é vinculada à origem HTTPS. Mudança de domínio exige nova instalação. Mudanças de ícone via painel de marca exigem regeneração/publicação das imagens na versão V1.
