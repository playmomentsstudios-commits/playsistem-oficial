# Saga — três resumos diários (PR de preparação, sem disparo)
- Horários solicitados: **07:00, 13:00, 19:00**, timezone **America/Sao_Paulo** (ajuste automático de offset quando aplicável).
- Política: **event_authorized**. Cada evento somente pode aparecer no resumo de quem tem autorização naquele evento; não usar lista global de clientes. Consentimento WhatsApp, preferências, acesso a projeto e bloqueios individuais são obrigatórios também no momento de enviar.
- **Tudo novo começa desligado**: `enabled=false` e `dispatch_enabled=false`. Nenhum cron, gatilho, Edge Function ou alteração em `wa_bridge_claim` é criado por esta migration. Não há mensagens em fila.
- Slots: `morning` (planejamento), `midday` (acompanhamento), `evening` (fechamento). A função `saga_digest_due_slots` somente consulta slots habilitados; não envia mensagens.
- `saga_digest_runs`: registro único por horário/data/destinatário, inicialmente draft.
- Limites existentes da ponte (250/dia configurável, intervalo de 1 min, 10/h, modo, consentimento) **não são modificados**; validação adicional no worker futuro.
## Etapas para ativação futura (ainda NÃO implementadas)
1. Confirmar contrato de eventos Saga e fonte de dados; mapear destinatário por evento, testar clientes com e sem acesso e revogação de consentimento.
2. Implementar worker que monta resumos por destinatário, sem vazamento de dados, e registra drafts em `saga_digest_runs`. Validar timezones, idempotência e deduplicação.
3. Testar prévias, limites e falhas em staging; aprovar manualmente.
4. Integrar cron com worker e WhatsApp outbox mantendo kill switch duplo. Só habilitar com autorização explícita do usuário.
## Como verificar a migração
```sql
select slot,local_hour,local_minute,timezone,enabled,dispatch_enabled
from public.saga_digest_schedules order by local_hour;
select * from public.saga_digest_due_slots('2026-10-17 10:00:00+00'::timestamptz);
```
Esperado: três linhas, ambas as flags false, e zero slots devidos.
