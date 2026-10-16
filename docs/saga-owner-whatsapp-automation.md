# Saga — resumo automático do gestor (WhatsApp)
Escopo: assistente **Saga do Play Sistem**, com entrega via ponte Baileys e
destinatário inicial já autorizado, identificado apenas por
`eufedesigner@gmail.com`. Nenhum envio por e-mail.

## Arquitetura
- Rotina independente da RKC: `automation_flows.event_key=saga_personal_ops`.
  O valor legado `source=chatgpt` é exigido pelo adaptador genérico
  `automation_enqueue_for_flow`/ponte; **não** atribui autoria a outra
  automação. A mensagem visível é sempre assinada **Saga**.
- `saga_ops_summary_preview` é leitura pura de tarefas operacionais, incluindo
  pendências, andamento, conclusão de hoje, prazos e até 4 prioridades.
- `saga_ops_run_tick` roda exclusivamente nas primeiras 20 min das janelas
  autorizadas 07h, 13h, 19h (America/Sao_Paulo), e revalida perfil, consentimento
  e saúde da ponte antes de enfileirar. Usa chave `sagaops_YYYYMMDD_HH`, e
  retorna `already_recorded` quando houver evento, mesmo que tarefas mudem.
- O adaptador reaproveita **sem modificar** os limites 250/dia, pacing 1 minuto,
  modo permitido, deduplicação, prova de envio e recibos existentes.
- A função administrativa `saga_ops_test_send()` permite testar **uma vez por
  dia**, apenas no número pessoal autorizado pela ponte, e produz mensagem
  identificada como teste.
- O cron `saga-owner-ops-minute` é instalado **desativado** até passar
  CI + E2E; qualquer ativação requer verificação de destinatário e estado.
- O fluxo concorrente `saga_owner_brief`, descoberto no banco, fica
  **desativado** para não haver duas automações sobrepostas.
- A tarefa programada no ChatGPT é separada e gera mensagem **somente naquele
  canal**. Ela não comprova a entrega no WhatsApp.

## Segurança e observabilidade
- Permissões RPC apenas serviço autorizado, não cliente/browser.
- `automation_events`, `whatsapp_message_outbox` e
  `whatsapp_bridge_attempts` mantêm trilha para distinguir
  `queued`, `sent`, `delivered`, `failed`.
- Sem criar projetos fictícios ou alterar tarefas.
- O registro de tarefas é fonte de verdade; aviso de conclusão de projeto
  depende do estado real. Nenhuma aprovação por mensagem é solicitada ao usuário
  depois da habilitação da rotina.
- Se a ponte estiver indisponível durante a janela, a rotina pode deixar de
  enviar aquele horário; não afirmar entrega e analisar a falha.

## Operação / fallback
Se precisar interromper somente a Saga: desative o cron
`saga-owner-ops-minute` e o fluxo `saga_personal_ops`.
Não pausar a ponte WhatsApp geral nem o cron `sagamente-push-v1`.
O canal ChatGPT tem programação independente às 07/13/19.

## Pendência de produto
Hoje a interface do cliente usa o adaptador legado, que inicialmente vincula a
notificação interna ao destino `/admin/whatsapp`; o corpo chega no WhatsApp,
mas o link de notificação deve ser adaptado futuramente ao destino de cliente.
