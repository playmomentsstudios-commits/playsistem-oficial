# Automações e Notificações — validação de 15/10/2026

## Resultado real

Um disparo foi criado pela API autenticada e entregue ao WhatsApp de Felipe Costa,
+55 62 99324-1277, usando a conta/ponte já conectadas.

- Evento: `5b69e58d-e7a8-455a-8adc-3f75bb47174c`.
- Outbox: `1b5c111f-e8d8-4700-8092-6762b29f2e8e`.
- Tentativa: `bb4b55e8-d6eb-4b7e-ab15-43f0473f784d`.
- ID WhatsApp: `3EB0387A0834FDB1FA20E1`.
- Comprovante observado: `delivered`, após chamada HTTP 202.
- Chave idempotente: `play-sistem:first-whatsapp-test:v1`.

A primeira chamada retornou 503 por falta de SELECT do service_role em auth.users.
Ela não gerou mensagem nem evento persistido. A consulta foi corrigida para usar
profiles.email com o destinatário previamente verificado na migration. Não foram
ampliadas permissões sobre auth.users. Uma execução SQL diagnóstica foi revertida
com ROLLBACK. Somente a chamada HTTP posterior criou a mensagem efetiva.

## Arquitetura

`POST automation-notifications → automation_enqueue → notifications + whatsapp_message_outbox
→ wa_bridge_claim → services/whatsapp-bridge/index.mjs → wa_bridge_finish → wa_bridge_record_receipt`.

A auditoria da função instalada encontrou diferenças em relação ao SQL antigo do
repositório. Foram preservados limite configurado de 250/dia, intervalo de 1 minuto,
10 tentativas/hora, modo consented_clients, consentimento, faixa de projetos e
boas-vindas. Somente uma condição adicional aceita eventos vinculados a automações
ativas, com telefone e cadastro de Felipe verificados. Não houve alteração de
cadastros, modelos existentes, mensagens de clientes, modo global ou serviço Node.
Rollback da condição adicional: `docs/rollbacks/automation-claim-restore.sql`.

## Banco e API publicados

Três migrations aplicadas ao projeto `lfmjqctiutajgtacvxfq`:

1. `automation_notifications_v1`: tabelas propostas, view privada e fila.
2. `automation_notifications_service_permissions`: correção sem conceder acesso a auth.users.
3. `automation_notifications_admin`: modelos, administração restrita e check-in manual.

Tabelas: automation_flows, automation_events, automation_delivery_attempts e
nova automation_credentials (apenas hash SHA-256 do token). Todas têm RLS.
`automation_delivery_attempts` permanece reservada; os comprovantes efetivos são
consultados na tabela existente whatsapp_bridge_attempts pela view
`automation_delivery_status`. O status persistido do evento continua queued;
a view é a fonte do estado de entrega efetivo.

A Edge Function `automation-notifications` foi publicada com autenticação própria.
O token dedicado não é um token Supabase e não é incluído no frontend. Apenas
seu hash fica no banco, sem acesso anon/authenticated. O segredo de teste não é
versionado; provisionar uma credencial própria no consumidor externo antes de
usar a integração continuamente. Chamadas sem autorização e com token inválido
retornaram 401 em produção.

POST com `Authorization: Bearer <token dedicado>`:

```json
{"source":"chatgpt","flow":"rkc_felipe","kind":"test"}
```

Texto solicitado fixo no servidor. A chave de teste é fixa e não gera novo disparo
em chamadas repetidas. Para check-in externo manual, usar `Idempotency-Key` único:

```json
{"source":"chatgpt","flow":"rkc_felipe","kind":"manual","title":"Check-in RKC","message":"Pendências e prazos verificados..."}
```

GET com a mesma autorização e `?key=<chave idempotente>` retorna comprovantes.
Queue e sendMessage não são entrega. Somente delivered/read confirmam entrega.

## Painel

Rota `/admin/automacoes`, item “Automações e Notificações” no grupo Comunicação.
Interface com lista, criar/editar, ativar/pausar, título/modelo, destinatário fixo,
check-in manual, teste idempotente e histórico expansível com status/erros.
Consulta automática de status a cada 15 segundos, com limpeza ao sair da página.
A automação “Check-in RKC — Felipe Costa” está cadastrada e ativa.
Cada nova automação continua restrita ao mesmo destinatário autorizado.

O frontend está no PR #475, sem merge/deploy de frontend nesta execução. O backend
publicado suporta esse painel assim que o frontend for publicado.

## Segurança e testes

14 testes novos aprovados: HTTP, limites, duplicidade, SQL/PGlite, claim atual,
comprovantes, rejeição de evento forjado, permissões service_role sem auth.users,
CRUD administrativo e recusa de sessões sem autorização administrativa.
29 testes selecionados do fluxo WhatsApp existente também aprovados.
Typecheck, build e Deno check executados. Lockfile preservado; Node 22.22.0 e
pnpm 10.30.3 para o projeto.

Advisors: RLS sem policies em credentials/attempts é intencional (sem acesso a
anon/authenticated). As duas RPCs administrativas SECURITY DEFINER verificam
explicitamente auth.uid() e current_user_is_admin(), possuem search_path vazio e
não são executáveis por anon. Esse acesso autenticado é intencional e foi testado
para negar clientes. Funções de enfileiramento e autenticação são SECURITY INVOKER
com execução somente por service_role. Nenhuma chave service_role foi exposta.

## Continuidade

O teste de agendamento foi ativado posteriormente pelo backend, de segunda a sábado,
às 08h, 13h e 18h em America/Sao_Paulo. Ele envia check-ins com pendências reais
registradas no projeto RKC. Detalhes em docs/rkc-checkin-schedule.md.
As pesquisas da automação do ChatGPT continuam separadas; não há repasse automático
do conteúdo gerado pelo ChatGPT nem coleta de editais pelo scheduler SQL.

Pausar uma automação impede novos eventos; mensagens já na fila seguem o estado
da fila existente. Não desligar a ponte global para pausar este módulo.
