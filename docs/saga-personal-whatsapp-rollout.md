# Saga — integração e recuperação automática dos resumos

## Situação real verificada em 17/10/2026
Os PRs #495, #496 e #497 já implantaram um fluxo específico `saga_personal_ops`
com resumo da gestão às 07h, 13h e 19h (Brasília), reaproveitando o transporte
WhatsApp existente, sem alterar a automação `rkc_felipe`.
O teste `sagaops_test_20261016` foi recebido/lido, com comprovante do provedor.

O envio das 07h de 17/10 criou o evento `sagaops_20261017_07`
com status **failed / bridge_preflight_failed**, sem outbox: não houve entrega.
A ponte WhatsApp global está `wa_bridge_auto_enabled=false`, e há 72 mensagens
antigas com status `ready_manual`; **não religar automaticamente a fila global**,
pois isso poderia enviar comunicações antigas para terceiros.

## Correção instalada
A migration `20261017132349_saga_ops_retry_guard.sql` mantém um único cron
`saga-owner-ops-minute` ativo, alterando o comando de
`saga_ops_run_tick()` para `saga_ops_retry_tick()`.
O wrapper:
1. Verifica previamente se a ponte global, heartbeat, modo e remetente estão válidos.
   Se pausada, retorna `bridge_paused` sem gerar evento fracassado.
2. Só envia nos horários 07h, 13h e 19h, nos primeiros 20 minutos.
3. Reaproveita o fluxo `saga_personal_ops`, sem tocar na RKC.
4. Se um evento de horário já tiver `outbox_id`, considera-o enfileirado,
   sem segunda entrega automática.
5. Caso apenas uma tentativa anterior tenha falhado **sem criar outbox**,
   admite até 3 novas tentativas idempotentes com chaves `_r1`, `_r2`, `_r3`.

## Migrações conciliadas
As migrações aplicadas ao Supabase para os protótipos não ativados
`20261017131721_saga_personal_brief_at` e
`20261017131727_saga_personal_tick` estão versionadas para integridade
do histórico, mas seus RPCs foram removidos na migration
`20261017132701_saga_trial_executor_cleanup`.
Não foi criado um segundo agendador.

## Para completar a entrega
O dono da conta precisa escolher uma estratégia para manter a ponte segura:
**não reativar o modo amplo `consented_clients` de forma irrestrita** com 72
itens antigos na fila. Uma habilitação para **único cliente de teste**, com
cutover explícito de início automático, evita disparos para outros clientes,
mas altera a configuração global da Central WhatsApp e deve ser homologada.
Também é preciso inspecionar a entrega real às 13h/19h e o cron do ChatGPT,
que é um canal independente.

**Sem e-mail; identidade Saga exclusiva do Play Sistem, em primeira pessoa.**
