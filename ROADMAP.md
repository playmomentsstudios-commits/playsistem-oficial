# Play Moments — Roadmap

## ✅ Concluído (esta fase)

- Arquitetura modular com estrutura de pastas organizada
- React Router v7 com todas as rotas públicas, `/app/*` e `/admin/*`
- AuthContext com login demo + integração JWT preparada
- CartContext para carrinho
- ToastContext para feedback visual
- Tipos TypeScript completos (User, Order, Product, Service, Conversation, Message, etc.)
- API client com autenticação por Bearer token
- Services de API: auth, products, services, orders, conversations, posts, settings
- Layouts: PublicLayout, CustomerLayout, AdminLayout
- PublicHeader responsivo com mobile menu
- Home premium com hero, stats, áreas, portfólio e CTA
- Página de Produtos com grid e busca
- Página de Serviços com cards por área
- Portfólio com filtros por categoria
- Comunidade / Mural com posts e reações (ReactionPicker preservado)
- Login e Cadastro
- Portal do Cliente: Dashboard, Perfil, Pedidos, Orçamentos, Conversas, Arquivos, Notificações
- Chat do cliente com histórico, grupos por dia, status de mensagem
- Admin: Dashboard, Clientes, Produtos, Pedidos, Conversas, Site Settings, Comunidade
- Central de Conversas Admin (WhatsApp-like)
- Gerenciamento de publicações do Mural no Admin
- Hono backend com rotas: auth, products, services, orders, conversations, messages, posts, settings, notifications
- Autenticação JWT com hash PBKDF2 seguro
- Soft delete arquitetado (campos deletedAt/deletedBy nos tipos)
- Documentação: README.md, .env.example, ROADMAP.md

## 🚧 Em desenvolvimento / Próximas fases

### Fase 2 — Integração completa
- [ ] Conectar frontend ao backend Supabase real (substituir dados demo)
- [ ] CRUD completo de produtos no Admin com upload de imagens
- [ ] CRUD de serviços no Admin
- [ ] CRUD de portfólio no Admin
- [ ] Página de detalhe de produto e serviço
- [ ] Carrinho funcional com checkout completo
- [ ] Fluxo de pedido: carrinho → checkout → pagamento → confirmação
- [ ] Upload de arquivos (Storage Supabase)
- [ ] Orçamentos: criação pelo Admin, aceite/recusa pelo cliente
- [ ] Pagamentos: integração Asaas (Pix + cartão)

### Fase 3 — Real-time & notificações
- [ ] WebSocket / Supabase Realtime para chat
- [ ] Notificações em tempo real
- [ ] Indicador "digitando..."
- [ ] Status online/offline
- [ ] Push notifications (service worker)

### Fase 4 — Admin avançado
- [ ] Dashboard com gráficos (Recharts)
- [ ] Relatórios de faturamento
- [ ] Gestão de categorias com drag-and-drop
- [ ] CMS completo da Home (seções ativáveis)
- [ ] Gestão de equipe (staff)
- [ ] Auditoria completa com logs
- [ ] SEO dinâmico por página

### Fase 5 — UX & SEO
- [ ] SSR ou SSG para SEO (migração para Next.js ou Vite SSR)
- [ ] Sitemap automático
- [ ] Open Graph dinâmico por produto/serviço/portfólio
- [ ] Progressive Web App (PWA)
- [ ] Dark/light mode toggle
- [ ] Acessibilidade (WCAG 2.1 AA)

### Fase 6 — Comunidade
- [ ] Comentários em posts
- [ ] Reações persistidas no banco
- [ ] Menções (@usuario)
- [ ] Clientes podem postar (configurável)
- [ ] Feed personalizado

## Pendências técnicas

| Item | Status | Notas |
|------|--------|-------|
| Backend Supabase conectado | Pendente | Edge Function pronta, credenciais necessárias |
| Upload de arquivos | Pendente | Supabase Storage a configurar |
| Pagamentos Asaas | Pendente | Arquitetura criada, token necessário |
| Realtime/WebSocket | Pendente | Estrutura preparada, Supabase Realtime a integrar |
| Email transacional | Pendente | Para confirmações e recuperação de senha |
