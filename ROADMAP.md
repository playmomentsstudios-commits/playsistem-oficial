# Play Moments — Estado da V1

## Base entregue

A plataforma atual utiliza Supabase Auth/Postgres/RLS, Edge Functions especializadas, Google Drive e Asaas. O antigo backend Hono/KV e autenticação demo foram aposentados.

Principais áreas em produção/código:
- site público, produtos, serviços, carrinho e checkout;
- pagamentos Asaas e pedidos;
- clientes, CRM, projetos, arquivos e Google Drive;
- portal do cliente e comunicação interna;
- colaboradores com RBAC e workspace dedicado;
- Landing Pages e campanhas;
- Academia com alunos, currículo, ofertas, trilhas, progresso, documentos e certificação.

## Fase final 10/10

Prioridades atuais:
1. segurança e integridade financeira;
2. redução de exposição PCI no cartão;
3. consistência/reconstrução de migrations e testes críticos;
4. automações operacionais;
5. comunicação transacional externa;
6. retenção/recompra com consentimento;
7. homologação das jornadas críticas, mobile e performance.

Novas funcionalidades que não resolvam esses objetivos devem ser tratadas como pós-V1 para evitar crescimento de escopo.
