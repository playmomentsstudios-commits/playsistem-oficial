# Assistente Sagamente — v1 (implantação segura)

## Escopo
Agente operacional da **Sagamente / Play Sistem**. Não usa o check-in da RKC. A camada v1 acompanha **eventos internos** de:
- cliente cadastrado / alteração de status do cadastro;
- criação de tarefa / mudança de status da tarefa;
- conclusão ou reabertura de checklist;
- mudança de status de etapa do projeto;
- compra da Academia confirmada (status paid/fulfilled);
- liberação de acesso ao acervo da Academia.

O sistema já tem a própria **Central WhatsApp**: boas-vindas, projetos, etapas, tarefas e compras geram seus eventos antigos de forma independente. O assistente NÃO deve duplicar esses disparos para clientes.

## Implantação conferida em 16/10/2026
- Repositório: `playmomentsstudios-commits/playsistem-oficial`.
- Projeto Supabase Play Sistem: `lfmjqctiutajgtacvxfq`.
- Migration Supabase **aplicada**: `20261016165507_assistente_sagamente_v1`.
- Arquivo versionado: `supabase/migrations/20261016165507_assistente_sagamente_v1.sql`.
- Tabelas novas: `sagamente_assistant_settings`, `sagamente_assistant_events`.
- Seis triggers de captura, função `sagamente_assistant_capture`, processador `sagamente_assistant_tick`.
- **Padrão desligado** (enabled=false, whatsapp_notifications=false, digest_times={}).
- Validação: `sagamente_assistant_tick()` devolveu status=disabled e 0 avisos; fila do assistente vazia. Nenhum disparo de cliente foi ativado.
- Teste transacional com rollback: 1 evento processado, 1 aviso interno, **0 mensagens WhatsApp**; alterações de teste revertidas.

O deploy da migration já foi feito diretamente no Supabase por ferramenta administrativa. **Não reaplicar** a mesma migration com outra versão; a pasta do GitHub usa a versão real do histórico do Supabase.

## Funcionamento
1. Quando `enabled=true`, os triggers capturam somente as mudanças relevantes e registram em `sagamente_assistant_events`.
2. `sagamente_assistant_tick()` registra o resumo nos minutos indicados em `digest_times`, usando `timezone` (padrão America/Sao_Paulo).
3. A função processa até 50 eventos pendentes por chamada, gravando avisos **internos** no `notifications` dos administradores ativos.
4. Os avisos são criados com `type='system'` e metadados `source='assistente_sagamente'`; o gatilho WhatsApp legado reconhece apenas uma lista fechada de outros tipos e os ignora. O sistema de push do app pode processá-los se houver assinaturas.
5. `whatsapp_notifications` existe como flag futura: **não há envio WhatsApp do Assistente nessa v1**.

## Configuração, após homologação e definição de horários
Não presumir horários da RKC como horários da Sagamente. Os horários abaixo são placeholders; escolher os reais com o responsável antes de executar:

```sql
-- Consultar primeiro:
select * from public.sagamente_assistant_settings;

-- Ativar em homologação após definir horários, por exemplo:
-- update public.sagamente_assistant_settings
-- set enabled = true, digest_times = array['HH:MM' /* outro HH:MM opcional */],
--     updated_at = now() where id = true;

-- Agenda pelo pg_cron (executar uma vez APÓS decisão de ativação):
-- select cron.schedule('sagamente-assistant-minute',
--   '* * * * *', 'select public.sagamente_assistant_tick();');
```

A chamada `tick()` só pode ser executada pelo servidor / service role, nunca diretamente pelo frontend. A tela administrativa futura poderá ler e atualizar apenas as configurações autorizadas pelo RLS (admin), mas não terá acesso para enfileirar eventos arbitrários.

## Verificações de aceitação
- Assistente desligado: sem novos eventos, sem resumo, sem mensagens;
- habilitado em ambiente controlado: cadastrar cliente, alterar status, checklist e liberar compra; observar exatamente um evento por alteração real;
- verificar fila e avisos internos de admin, sem entrada adicional no `whatsapp_message_outbox` proveniente de eventos do assistente;
- verificar que o resumo diário só aparece uma vez por data e horário, mesmo com execuções repetidas (event_key único);
- conferir permissão RLS de cliente (não vê configurações nem eventos do agente);
- conferir que o agendamento respeita o fuso configurado.

## Desativação
```sql
update public.sagamente_assistant_settings set enabled=false, updated_at=now() where id=true;
-- Se o agendamento já tiver sido configurado:
-- select cron.unschedule('sagamente-assistant-minute');
```

## Próximas etapas
1. Definir horários exatos dos resumos e destinatários.
2. Homologar gatilhos sem disparos externos e criar painel compacto em Admin > Assistente Sagamente.
3. Analisar o canal WhatsApp existente (bridge, modo piloto, autorização por destinatário e deduplicação), para uso futuro sem duplicar envios de compras e tarefas.
4. Conectar a análise dos repositórios institucionais e das atividades do Supabase institucional **somente em leitura**, com autorização específica para ações que alterem dados.

## Identidade e comunicação — decisão de Felipe (16/10/2026)
- O agente operacional **Assistente Sagamente** terá o nome de apresentação **Saga**. O usuário responsável e interlocutor é **Felipe**.
- Nos conteúdos **gerados pelo próprio assistente**, identificar claramente a autoria: por exemplo, **"Saga | Relatório de atividades"**, **"Saga | Atualização de tarefa"**, **"Saga | Alerta operacional"**. Evitar assinar como "ChatGPT", "Robô" ou "Assistente Sagamente" quando a mensagem é da persona Saga.
- Comunicação dirigida a Felipe: português brasileiro, tom masculino na **redação**, natural, direto, profissional e sintético, com descrição objetiva do fato, horário, providência e link interno quando aplicável. A escolha da voz audível depende das configurações do aplicativo, não do banco de dados.
- **Não renomear nem reescrever notificações legadas da Central WhatsApp** que não tenham sido produzidas pelo Saga. Não enviar disparos de teste ou produção a clientes sem fluxo validado, consentimento e autorização.
- O fato de a Saga ser a identidade projetada da assistente nesta conversa **não implica conexão automática** entre uma sessão do ChatGPT e a execução no servidor. A implementação deve materializar essa identidade nos títulos, modelos e canais apropriados, quando estes forem desenvolvidos.

## Handoff obrigatório — nova conversa ou outra conta
Ao retomar o trabalho em outra conversa/conta, **não assumir que o histórico nem as conexões foram transferidos**. Primeiro:
1. Ler integralmente este documento e o PR [#490](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/490); verificar o estado atual do PR, commits, arquivos e branch `feature/assistente-sagamente-v1-20261016`. Inspecionar possíveis mudanças desde o registro, sem sobrescrevê-las.
2. Conectar/verificar permissões GitHub `playmomentsstudios-commits/playsistem-oficial` e Supabase Play Sistem `lfmjqctiutajgtacvxfq`. **Não usar recursos da RKC** ou disparos `rkc_felipe` para a Saga. A infraestrutura institucional da Sagamente é outra frente: repositório `sagamente/SAGAMENTE` e Supabase `rrshonsmxqauuwptrmde`; qualquer análise inicial destes deve ser apenas leitura.
3. Conferir no Supabase: migração `20261016165507_assistente_sagamente_v1` aplicada; tabelas `sagamente_assistant_settings` e `sagamente_assistant_events`; presença de funções/triggers; RLS e controle de execução server-side; configuração `enabled=false`, `whatsapp_notifications=false`, `digest_times={}`, fuso `America/Sao_Paulo`; fila vazia no último teste. **O estado do ambiente real deve prevalecer sobre esta fotografia de 16/10.**
4. Verificar agendamentos `pg_cron`, automações ativas e o mecanismo pré-existente `whatsapp_message_outbox`; não usar os horários de outra automação como horários da Saga. Garantir ausência de novos envios a clientes, duplicações ou alterações na ponte WhatsApp.
5. Prioridade escolhida pelo Felipe: **implementar primeiro o HISTÓRICO DE EVENTOS** no painel `Admin > Assistente Sagamente`, depois preferências de horários/notificações. O painel ainda **não estava entregue** quando esta instrução foi escrita. Inspecionar `src/AppV2.tsx`, `src/layouts/AdminLayout.tsx`, os componentes de administração e a migração real antes de programar.
6. Criar a interface somente para administrador, começando com consulta paginada, filtros de tipo/status/data, detalhes do evento, horário em `America/Sao_Paulo`, indicação de fila/processamento/falha e estado geral "desativado". **Nunca expor service_role no cliente; não chamar `sagamente_assistant_tick()` no navegador.** Verificar a política de leitura RLS; se bloqueada, criar mecanismo restrito seguro e migrado adequadamente antes da interface.
7. Validar compilação, testes, RLS, isolamento cliente/admin, duplicação de alertas e não regressão nos fluxos WhatsApp. Fazer alterações na mesma branch e atualizar PR; **não integrar no main nem ativar cron, captura, notificações externas ou WhatsApp sem homologação e decisão expressa**.
8. **Horários de resumo, destinatários internos e regras finais de envio ainda não foram definidos por Felipe.** Solicitar essa decisão somente quando for indispensável para ativar, não para implementar o histórico.
9. Registrar o que foi alterado, comprovantes de teste e bloqueios neste PR para facilitar continuidade. Se a conversa for compartilhada em outra conta, reconectar separadamente ferramentas e conferir permissões; compartilhar uma conversa não migra acessos.

### Ponto de retomada em 16/10/2026
- **Concluído**: base v1 Supabase, documentação e teste transacional reversível (1 evento, 1 aviso interno, 0 WhatsApp; rollback). PR #490 em rascunho.
- **Ainda pendente**: a tela do histórico de eventos, configuração e horários, homologação ampliada, agendamento, ativação; integração institucional somente leitura; integração futura WhatsApp deduplicada.
- **Garantia operacional**: `enabled=false` até aprovação e testes. Não confundir "migração instalada" com "agente em produção".
