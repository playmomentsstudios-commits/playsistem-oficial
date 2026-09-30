# Play Moments V1 — fechamento técnico remoto

## Objetivo
Checklist único para alinhar o Supabase remoto ao código homologado antes do baseline final. Não substitui validação visual/E2E.

## SQL — executar no Supabase SQL Editor, nesta ordem
1. `20260929173000_operational_automation_engine.sql`
2. `20260929174500_operational_automation_cron.sql`
3. `20260929180000_transactional_event_communications.sql`
4. `20260929183000_transactional_email_outbox.sql`
5. `20260929184500_transactional_email_retry_policy.sql`
6. `20260929233000_conversion_funnel_analytics.sql`
7. `20260929234500_conversion_funnel_summary.sql`
8. `20260930005000_crm_reengagement_opportunities.sql`

Não renumerar nem reescrever migrations históricas já registradas no projeto remoto. Confirmar o histórico antes de qualquer reconciliação.

## Edge Functions — publicar a versão atual do main
- `asaas-webhook`: inclui validação de valor e fonte única de confirmação transacional.
- `asaas-create-checkout`: checkout hospedado + URL efetiva persistida para retomada.
- `google-drive-file-manage`: organização/movimentação de arquivos por projeto.

## Edge Functions legadas — retirar do remoto se existirem
- `asaas-card-payment`: fluxo direto de PAN/CVV foi aposentado em favor do checkout hospedado.
- `server`: backend legado removido do repositório.

## Verificações após sincronização
- cron `play-moments-operational-daily` existe e está agendado;
- painel /admin/conversao carrega 7/30/90 dias sem erro;
- webhook Asaas aceita evento válido e rejeita divergência de valor;
- cartão abre checkout hospedado e pode ser retomado enquanto pendente;
- organização de arquivo por projeto funciona sem apagar o objeto físico no Drive;
- outbox transacional recebe eventos, mas não envia externamente enquanto não houver provedor configurado;
- oportunidades de reengajamento são internas e não disparam mensagens automáticas ao cliente.

## Gate do baseline final
Só criar/marcar baseline final depois de SQL + Functions acima estarem sincronizados e as jornadas críticas passarem na homologação. Se qualquer item falhar, corrigir antes do backup/tag final.
