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
- **Saga** é o nome de apresentação do assistente operacional **somente no Play Sistem** e nas mensagens originadas desse módulo. Sagamente continua sendo a empresa/marca; RKC e os demais aplicativos conservam identidade própria.
- Nos conteúdos **gerados pelo próprio assistente**, identificar claramente a autoria: por exemplo, **"Saga | Relatório de atividades"**, **"Saga | Atualização de tarefa"**, **"Saga | Alerta operacional"**. Evitar assinar como "ChatGPT", "Robô" ou "Assistente Sagamente" quando a mensagem é da persona Saga.
- Redação do assistente em português brasileiro, **primeira pessoa** ao relatar ações próprias: "Preparei seu resumo", "Não consegui enviar" e "Vou tentar novamente" somente quando uma nova tentativa estiver de fato programada. Não escrever "A Saga não conseguiu" como se outra pessoa estivesse narrando. Tom profissional, natural e breve; preservar fatos, horários, providências e links. Não atribuir sucessos não comprovados.
- **Não renomear nem reescrever notificações legadas da Central WhatsApp** que não tenham sido produzidas pelo Saga. Não enviar disparos de teste ou produção a clientes sem fluxo validado, consentimento e autorização.
- **Escopo estrito:** essa nomenclatura vale apenas para o módulo Saga/Play Sistem. Não define um apelido ou personalidade global do ChatGPT e **não deve ser propagada a outros chats** nem a notificações de outros fluxos. A identidade de produto não estabelece conexão automática entre uma conversa do ChatGPT e a execução no servidor.

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


## Etapa 2 — histórico paginado e controle de permissões (16/10/2026)

### Implementado no PR #490
- Painel `/admin/saga` atualizado para consulta **paginada no servidor** (25 itens), com contagem exata, ordenação por data e ID e navegação entre páginas. Não há mais corte arbitrário nos 100 registros recentes.
- Filtros no servidor: tipo, status, período com limites por dia no fuso de Brasília, e relatórios diários isolados na própria aba. Detalhes incluem origem, mensagem, data de processamento, ID e link interno validado.
- O painel informa o estado real obtido do banco; quando não é possível consultar, exibe indisponibilidade, sem indicar falsamente que o agente foi desativado.
- Atalho `Saga` permanece configurável sem alterar o padrão aprovado de **sete** atalhos principais do dashboard (correção do teste `admin-dashboard-shortcuts`).
- Novo teste `tests/saga-assistant-panel.test.mjs` confere paginação, isolamento admin, ausência de execução do processador no cliente e concessões de coluna.

### Segurança no Supabase Play
- Migration **aplicada e versionada**: `20261016173621_saga_restrict_settings_update_columns`.
- O papel `authenticated` perdeu o `UPDATE` de toda a tabela `sagamente_assistant_settings`; somente as colunas `internal_notifications`, `digest_times` e `updated_at` podem ser atualizadas. A política RLS de admin permanece em vigor.
- Verificação das concessões no banco: update em `enabled=false` (permissão negada), `whatsapp_notifications=false` (permissão negada), e permitido apenas para as três colunas de preferências. Isso impede que chamadas arbitrárias do navegador acionem flags sensíveis.
- Configuração verificada após migração: `enabled=false`, `whatsapp_notifications=false`, `digest_times={}`, fila de eventos vazia.
- Existem tarefas de cron legadas com nomes `sagamente-push-v1` e `play-rkc-checkin-test`; **não foram tocadas**. Não confundir com `sagamente-assistant-minute`, que não foi criado nesta etapa.

### Pendências antes de ativar
1. Validar a execução do CI **mais recente** e navegação autenticada no preview; não usar o status anterior como comprovação do commit atual.
2. Testar a leitura com uma sessão autenticada admin e uma sessão de cliente/staff negada; as políticas foram examinadas, mas o teste de ponta a ponta por sessão ainda depende de homologação.
3. Testar alterações reais de cada um dos seis gatilhos num ambiente isolado ou numa janela controlada, mantendo emissão para clientes desabilitada; conferir unicidade do evento e inexistência de duplicação no WhatsApp.
4. Definir horários reais e destinatários internos com Felipe. Não configurar cron, não ativar `enabled` e não habilitar canais externos sem autorização expressa.
5. O banco v1 possui apenas os estados `pending` e `internal_sent`; indicação formal de falhas/reprocessamento exige modelagem posterior, não inventar erros na interface.

**PR continua em rascunho. Não integrar no `main` sem revisão e homologação.**

## Etapa 3 — verificação funcional de RLS e isolamento (16/10/2026)

**Executado diretamente no Supabase Play, sem ativar o agente:**
- Conferidas as seis triggers `sagamente_assistant_*` instaladas e habilitadas nas tabelas previstas. Isso prova existência/ligação dos gatilhos, **não** comprova ainda o funcionamento ponta a ponta de cada caso de negócio.
- As tabelas `sagamente_assistant_settings` e `sagamente_assistant_events` mantêm RLS ativa.
- Simulação de autenticação Postgres em transação com `SET LOCAL ROLE authenticated` e `request.jwt.claim.sub` equivalente a um perfil existente: perfil **admin** enxerga 1 linha de settings; perfil **customer** enxerga 0. Perfil `staff` não pôde ser simulado com usuário existente (nenhuma linha encontrada no teste).
- Evento efêmero criado **apenas na tabela de eventos**, dentro de transação `BEGIN ... ROLLBACK` (nenhum dado de negócio modificado): simulação admin leu 1 evento; customer leu 0. Confirma visibilidade RLS, inclusive quando há um registro, sem gerar avisos.
- Permissão SQL do papel `authenticated` para `enabled` e `whatsapp_notifications`: **negada** nos dois perfis. `digest_times` permanece campo concedido, mas somente RLS de admin permite escrita efetiva.
- Atualização sem mudança de valor de `internal_notifications`, com `ROLLBACK`: admin conseguiu atualizar 1 linha; customer não atualizou nenhuma. Nenhuma preferência foi persistida.
- Chamada de segurança `public.sagamente_assistant_tick()` com `enabled=false`: resultado `{status:disabled,internal_sent:0}`; fila permaneceu em 0 e nenhum envio foi executado.
- Configuração final consultada: `enabled=false`, `whatsapp_notifications=false`, `digest_times={}`, `America/Sao_Paulo`; cron `sagamente-assistant-minute` inexistente. Os agendamentos legados foram preservados.

**Limites da homologação:** não houve sessão real de navegador com login admin, teste real de staff (sem perfil apto), nem exercício dos seis gatilhos nos registros de origem. Evitamos modificar tabelas operacionais de clientes/projetos/compras em produção, mesmo com rollback, para não provocar outros fluxos ou integrações de terceiros. Esses testes devem ocorrer em ambiente isolado ou ser conduzidos com autorização explícita para os dados envolvidos.

**Próximo checkpoint:** validar UI autenticada no preview (histórico, filtros, paginação, configurações e estados vazios), teste E2E negando cliente/staff, depois testar os seis gatilhos isoladamente com deduplicação e outbox WhatsApp. Não ativar cron, WhatsApp ou `main` por efeito desses testes.


## Etapa 4 — prévias internas dos resumos (revisão em PR #490)

- Configuração de horários confirmada pelo responsável em 16/10/2026: `07:00`, `13:00`, `19:00` em `America/Sao_Paulo`. Foi salva no Supabase Play Sistem em `sagamente_assistant_settings.digest_times` enquanto `enabled=false` e `whatsapp_notifications=false`, sem execução de cron.
- A nova aba **Prévia dos resumos** na rota administrativa existente `/admin/saga` exibe uma simulação **somente leitura** dos eventos internos capturados (sem enviar nem criar filas). Usa a sessão Supabase autenticada, valida perfil admin ativo e depende das policies RLS administrativas de `sagamente_assistant_events`.
- Janelas locais: 07h (19h do dia anterior até 06h59), 13h (07h até 12h59), 19h (13h até 18h59). Deduplicação por ID, seleção por fontes internas conhecidas e exclusão do evento `daily_digest` para não resumir resumos.
- Seleção por horário usa os registros já existentes; eventos capturados no Supabase eram **zero** na última consulta, portanto a interface deve exibir o estado vazio fielmente. Se houver muitos registros (>500 na consulta limitada de 48h), a prévia falha explicitamente em vez de ocultar o truncamento.
- A consulta **não é** a implementação de envio para destinatários externos. Para clientes, permissões, consentimento e acesso de projeto devem ser verificados **por evento** no backend (trabalho independente em [PR #491](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/491)).
- **Dívida de integração:** PR #491 prepara `saga_digest_schedules` de forma isolada; antes de qualquer merge/ativação, a equipe deverá consolidar a fonte da verdade de horários com `sagamente_assistant_settings.digest_times` para não introduzir duas configurações divergentes.
- **Desligado:** não há cron novo, disparo WhatsApp, trigger adicional, call a `sagamente_assistant_tick` nem publicação do painel em produção por esta etapa.
- Testar build, UI autenticada, isolamento admin/cliente e vazios no preview antes de mesclar. Não interpretar aprovação de CI como teste end-to-end de entrega WhatsApp.


## Contrato de voz da Saga — 16/10/2026
- **Emissor:** nome visível "Saga" somente em mensagens criadas pelo assistente no Play Sistem; cabeçalho "Saga | ..." opcional. **Voz:** primeira pessoa quando o assistente descreve ação própria; fatos de projeto podem ser objetivos em terceira pessoa.
- **Fases da entrega:** "Preparei" para rascunho; "Coloquei na fila" apenas após enfileiramento confirmado; "Enviei" apenas após evidência de envio; "Entreguei" apenas após confirmação de entrega pelo provedor; "Não consegui enviar" para falhas confirmadas. Nunca afirmar entrega com base somente em fila.
- **E-mail:** `eufedesigner@gmail.com` foi usado unicamente para localizar o cadastro de homologação já autorizado; os envios do projeto Saga são pelo WhatsApp. Não adicionar e-mail como canal sem novo pedido.
- **Homologação:** o envio de teste foi realizado por fluxo legado isolado de automação e teve confirmação de entrega pela ponte; isso **não valida automaticamente** o futuro emissor próprio da Saga. Não reutilizar o nome da RKC como assinatura da Saga nem mudar `automation_enqueue` como solução definitiva.
- **Segurança:** consentimento e vínculo de projeto checados novamente na entrega; duplicidade por destinatário/evento; logs de `queued`, `sent`, `delivered`, `failed`; pausas e limites existentes da Baileys preservados.
- **Outras conversas:** manter suas configurações de personalidade independentes; a marca Saga é uma identidade implementada no software, não identidade universal do ChatGPT.
