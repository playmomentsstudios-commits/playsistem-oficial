# Saga — resumos às 07h, 13h e 19h (preparação, sem envio)

## Dependência de integração
O PR #491 é intencionalmente **empilhado sobre a branch do PR #490**. O CI
precisa validar o conjunto das duas alterações antes da homologação.
Mesmo que os testes passem, ambos permanecem em rascunho e não há deploy.

## Fonte única de horários
Os horários aprovados pelo responsável estão salvos em
`public.sagamente_assistant_settings.digest_times` como
`['07:00','13:00','19:00']`, timezone `America/Sao_Paulo`.
A migração proposta **não cria `saga_digest_schedules`**. O PR #490 e a
configuração já existente no Supabase Play são a fonte única da agenda.

`saga_digest_due_slots(at)` é uma consulta somente leitura que retorna o
horário corrente apenas se `sagamente_assistant_settings.enabled=true`.
Não existe job cron, ponte, worker ou enfileiramento associados à função.
O banco foi conferido antes da edição: a migração do PR #491 ainda não
estava aplicada; não havia tabela de execução nem agenda paralela.

## Registro preparatório
`saga_digest_runs` mantém uma chave única por (`slot`,`local_day`,
`recipient_user_id`) para futuro trabalho auditado. Não armazena telefone,
não envia notificações e tem RLS sem policy para `authenticated`/`anon`.
O PR continua um rascunho: **não aplicar em produção antes da revisão**.

## Segurança de prévias
- As funções puras geram somente **prévia**; devem rodar no servidor.
- Apenas eventos `project_stage_status` ligados a etapas visíveis de projetos
  não internos têm resolução de autorização de clientes nesta versão.
- Por evento, revalidar: cliente ativo, opt-in WhatsApp, telefone correspondente,
  preferência explícita, etapa visível, propriedade/acesso ao projeto.
- Qualquer dado ausente, erro ou falta de consentimento significa **negar**.
- Não usar esse filtro administrativo nem um `Set` vindo do navegador como
  autorização real de destinatário.
- Somente construir a prévia após checagem no servidor. Antes de eventual envio
  futuro, revalidar tudo outra vez e honrar as regras de limite e espaçamento
  da ponte atual.

## Janelas sem sobreposição
- 07h: 19h do dia anterior até 06h59.
- 13h: 07h até 12h59.
- 19h: 13h até 18h59.

## Gates da homologação
1. CI, auditoria de migrations e isolamento de banco precisam passar no commit
   mais recente.
2. Testar uma sessão real admin, e negativa de cliente/staff, em staging,
   não só mock/teste SQL.
3. Validar origem real dos eventos e as permissões/consentimentos por evento;
   outros eventos (compras, cadastro etc.) permanecem fora do público cliente.
4. Reconciliar o digest legado de `sagamente_assistant_tick` com o eventual
   worker novo para **não duplicar** notificações.
5. Somente após aprovação expressa implementar cron e outbox com dupla
   proteção; manter `enabled=false`, `whatsapp_notifications=false` até lá.
   Não alterar bridge nem automações da RKC.

## Verificação (somente após migration revisada em staging)
```sql
select enabled, whatsapp_notifications, digest_times, timezone
from public.sagamente_assistant_settings where id=true;
select * from public.saga_digest_due_slots('2026-10-17 10:00:00+00'::timestamptz);
```
Com o agente desligado, o segundo SELECT retorna **zero linhas**.
