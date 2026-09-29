# Play Moments — UX & Growth Foundation (#201)

## Objetivo
O marco #200 permanece como baseline de rollback. A partir do #201, a prioridade é qualidade percebida e mensurável: clareza, velocidade, feedback, conversão, acessibilidade e confiabilidade. Não ampliar módulos sem necessidade.

## Regra de dados
### Supabase
Guardar somente dados estruturados e leves:
- textos e configurações;
- relacionamentos e estados;
- slugs e metadados SEO;
- IDs/referências do Google Drive;
- permissões/RLS;
- hashes e evidências;
- eventos de negócio realmente necessários.

### Google Drive
Guardar binários e mídia:
- imagens;
- vídeos;
- PDFs;
- documentos;
- materiais e demais arquivos pesados.

Nenhuma nova funcionalidade deve criar armazenamento binário paralelo no Supabase sem justificativa técnica documentada.

## Reuso antes de criar
A plataforma já possui `site_settings`, `home_service_areas`, perfil/portfólio e a função de upload de assets do site para o Google Drive. SEO global básico já existe em `site_settings.meta_description`. Evoluções devem estender essas estruturas quando compatíveis, e não criar CMS/configurações duplicadas.

## Padrão UX obrigatório
Toda jornada nova ou revisada deve considerar:
1. estado inicial claro;
2. carregamento perceptível sem bloquear desnecessariamente;
3. sucesso com feedback e próxima ação;
4. erro compreensível, recuperável e sem perda silenciosa;
5. estado vazio orientando o que fazer;
6. prevenção de duplo envio;
7. responsividade mobile-first;
8. foco/teclado/labels e contraste;
9. menor número razoável de decisões por tela;
10. preservação de contexto ao navegar/autenticar.

## Superfícies da auditoria
### Público
Home, Serviços, Produto, Categorias, Quem Somos/Portfólio, Contato, Academia, autenticação e cadastro.

### Conversão
CTA → serviço/orçamento/conversa; produto → carrinho → checkout/pagamento; Academia → curso → conta/matrícula quando necessária.

### Cliente
Dashboard, perfil, pedidos, serviços, orçamentos, pagamentos, projetos, arquivos, conversas, notificações, comunicados, Academia e configurações.

### Admin
Dashboard, CRM/clientes, catálogo, vendas, pagamentos, projetos, arquivos, conversas, equipe/RBAC, site, relatórios, auditoria e Academia.

## Critério de aceite de uma tela
Uma tela só pode ser considerada homologada quando:
- objetivo principal é evidente;
- CTA primário é inequívoco;
- loading/empty/error/success estão tratados;
- funciona em mobile;
- navegação e retorno preservam contexto;
- operações destrutivas têm proteção;
- não depende de arquivo pesado armazenado no Supabase;
- eventos de conversão relevantes podem ser medidos sem registrar ruído ou dados sensíveis.

## Próximos marcos
- #202 UX público/Home e posicionamento
- #203 Landing Pages e campanhas
- #204 SEO técnico e social
- #205 Compra e conversão
- #206 Portal do Cliente
- #207 Academia
- #208 Admin + acessibilidade/mobile
- #209 performance, analytics, observabilidade e E2E
- #210 homologação final
