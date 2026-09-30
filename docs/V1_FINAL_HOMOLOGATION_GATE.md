# Play Moments V1 — Gate de homologação final

Baseline candidato após o merge do #241. Este documento separa o que já é verificável no repositório do que depende do ambiente remoto.

## Evidência automatizada no repositório
O CI deve executar toda a suíte atual, incluindo segurança/RBAC, comércio/Asaas, Drive, Academia, navegação, workspace de colaboradores, integridade de migrations, automações, comunicações transacionais, funil de conversão, reengajamento e exclusão segura de projetos.

## Gate remoto obrigatório
Antes de declarar V1 homologada e criar o backup/tag final:
- concluir integralmente `docs/V1_REMOTE_RELEASE_CHECKLIST.md`;
- confirmar migrations remotas e Edge Functions sincronizadas;
- confirmar retirada de `server` e `asaas-card-payment` remotos, se existirem;
- validar cron operacional;
- validar que o outbox continua sem envio externo enquanto não houver provedor configurado.

## Jornadas E2E de homologação
1. Público → produto → carrinho → checkout → PIX/cartão hospedado → pedido/pagamento.
2. Serviço → orçamento/contratação → projeto → conversa → arquivos no Drive → conclusão.
3. Academia → matrícula → curso → atividade/avaliação → progresso → conclusão → documento/certificado.
4. Admin Master → clientes/CRM → projetos/tarefas → pagamentos → arquivos → conversão/relatórios.
5. Colaborador → permissões/RBAC → workspace claro → somente módulos autorizados.
6. Landing/campanha → evento first-party → atribuição → painel de conversão 7/30/90 dias.
7. Mobile → navegação, formulários, checkout e áreas autenticadas nas larguras críticas.

## Critério de fechamento
A V1 só recebe baseline/backup final quando: CI verde; checklist remoto concluído; jornadas críticas acima sem blocker; nenhum P1/P2 aberto nas mudanças finais. Achados de homologação geram correção antes do baseline.

## Estado atual
Código: candidato a homologação final.
Remoto/E2E: pendente de execução/confirmação. Portanto este documento não declara produção 10/10 por antecipação.
