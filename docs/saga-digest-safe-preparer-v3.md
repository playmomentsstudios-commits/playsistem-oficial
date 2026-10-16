# Saga — preparador seguro de resumos (V3)

Implementação incorporável ao banco Supabase Play, sem modificar a Central WhatsApp
ou o fluxo da RKC.

## O que funciona
- A função privada `saga_digest_preview_at(timestamptz)` lê eventos `project_stage_status`
  nas janelas 07h (19h anterior até 07h), 13h (07h–13h) e 19h (13h–19h),
  usando `America/Sao_Paulo` e horários de `sagamente_assistant_settings`.
- Filtra destinatários por perfil ativo, opt-in, telefone validado pela função
  atual da ponte, preferência de atualizações, vínculo com projeto não interno
  e etapa visível. Retorna somente conteúdo individual, com máximo de 30 eventos.
- A função `saga_digest_prepare_tick()` pode armazenar no futuro **somente rascunhos**
  na tabela `saga_digest_runs`, de forma idempotente.
- Novos controles `saga_digest_runtime_controls.prepare_enabled=false` e
  `dispatch_enabled=false` são protegidos por RLS sem acesso a anon/authenticated.
- A função é somente `service_role`. Não escreve `notifications` nem
  `whatsapp_message_outbox`, nem altera `wa_bridge_claim`.

## Evidência de homologação
Migração aplicada com ID de banco `20261016223121`. Teste SQL em uma única transação:
inserção de um evento de projeto visível com horário 06h30; prévia gerou
**um** destinatário autorizado e **um** evento. Após ocultar a etapa
transitoriamente, a prévia voltou vazia. `saga_digest_prepare_tick()`
retornou `disabled`. O `ROLLBACK` deixou **zero** eventos de teste e
**zero** rascunhos permanentes; os interruptores ficaram OFF.

## O que NÃO está liberado
- Nenhum cron novo ou execução automática foi programada nesta migração.
- Nenhum envio real, áudio ou WhatsApp foi gerado.
- A autorização deve ser revalidada **no momento do despacho** antes de eventual
  integração ao `wa_bridge_claim`; só então preservar limite 250/dia,
  intervalo de 1 minuto e condições de conexão da ponte.
- Não misturar `daily_digest` interno do `sagamente_assistant_tick` com
  os resumos de clientes, evitando disparos duplicados.
- Só ativar preparação e disparo após E2E autenticado e autorização explícita.

## Próximos passos
Configurar cron **inativo**, validar o ciclo de disparo em um número de teste
autorizado, revisar a rechecagem do consentimento na ponte, verificar comprovante
de entrega, e só depois liberar clientes. A migração atual não executa isso.

## Agendador registrado, mas INATIVO
A migração `20261016223403_saga_digest_inactive_cron.sql` foi aplicada ao
Supabase Play. O job `saga-digest-draft-preparer-minute` tem agenda
`* * * * *`, comando `select public.saga_digest_prepare_tick();` e
`active=false`. O próprio SQL verifica a condição inativa antes de confirmar
a transação. `sagamente-push-v1` e a Central WhatsApp permanecem intocados.
Não existe autorização para ativar o job nesta etapa.
