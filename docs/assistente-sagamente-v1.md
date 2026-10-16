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
- Repositório: \`playmomentsstudios-commits/playsistem-oficial\`.
- Projeto Supabase Play Sistem: \`lfmjqctiutajgtacvxfq\`.
- Migration Supabase **aplicada**: \`20261016165507_assistente_sagamente_v1\`.
- Arquivo versionado: \`supabase/migrations/20261016165507_assistente_sagamente_v1.sql\`.
- Tabelas novas: \`sagamente_assistant_settings\`, \`sagamente_assistant_events\`.
- Seis triggers de captura, função \`sagamente_assistant_capture\`, processador \`sagamente_assistant_tick\`.
- **Padrão desligado** (enabled=false, whatsapp_notifications=false, digest_times={}).
- Validação: \`sagamente_assistant_tick()\` devolveu status=disabled e 0 avisos; fila do assistente vazia. Nenhum disparo de cliente foi ativado.

O deploy da migration já foi feito diretamente no Supabase por ferramenta administrativa. **Não reaplicar** a mesma migration com outra versão; a pasta do GitHub usa a versão real do histórico do Supabase.

## Funcionamento
1. Quando \`enabled=true\`, os triggers capturam somente as mudanças relevantes e registram em \`sagamente_assistant_events\`.
2. \`sagamente_assistant_tick()\` registra o resumo nos minutos indicados em \`digest_times\`, usando \`timezone\` (padrão America/Sao_Paulo).
3. A função processa até 50 eventos pendentes por chamada, gravando avisos **internos** no \`notifications\` dos administradores ativos.
4. Os avisos são criados com \`type='system'\` e metadados \`source='assistente_sagamente'\`; o gatilho WhatsApp legado reconhece apenas uma lista fechada de outros tipos e os ignora. O sistema de push do app pode processá-los se houver assinaturas.
5. \`whatsapp_notifications\` existe como flag futura: **não há envio WhatsApp do Assistente nessa v1**.

## Configuração, após homologação e definição de horários
Não presumir horários da RKC como horários da Sagamente. Os horários abaixo são placeholders; escolher os reais com o responsável antes de executar:

\`\`\`sql
-- Consultar primeiro:
select * from public.sagamente_assistant_settings;

-- Ativar em homologação após definir horários, por exemplo:
-- update public.sagamente_assistant_settings
-- set enabled = true, digest_times = array['HH:MM' /* outro HH:MM opcional */],
--     updated_at = now() where id = true;

-- Agenda pelo pg_cron (executar uma vez APÓS decisão de ativação):
-- select cron.schedule('sagamente-assistant-minute',
--   '* * * * *', 'select public.sagamente_assistant_tick();');
\`\`\`

A chamada \`tick()\` só pode ser executada pelo servidor / service role, nunca diretamente pelo frontend. A tela administrativa futura poderá ler e atualizar apenas as configurações autorizadas pelo RLS (admin), mas não terá acesso para enfileirar eventos arbitrários.

## Verificações de aceitação
- Assistente desligado: sem novos eventos, sem resumo, sem mensagens;
- habilitado em ambiente controlado: cadastrar cliente, alterar status, checklist e liberar compra; observar exatamente um evento por alteração real;
- verificar fila e avisos internos de admin, sem entrada adicional no \`whatsapp_message_outbox\` proveniente de eventos do assistente;
- verificar que o resumo diário só aparece uma vez por data e horário, mesmo com execuções repetidas (event_key único);
- conferir permissão RLS de cliente (não vê configurações nem eventos do agente);
- conferir que o agendamento respeita o fuso configurado.

## Desativação
\`\`\`sql
update public.sagamente_assistant_settings set enabled=false, updated_at=now() where id=true;
-- Se o agendamento já tiver sido configurado:
-- select cron.unschedule('sagamente-assistant-minute');
\`\`\`

## Próximas etapas
1. Definir horários exatos dos resumos e destinatários.
2. Homologar gatilhos sem disparos externos e criar painel compacto em Admin > Assistente Sagamente.
3. Analisar o canal WhatsApp existente (bridge, modo piloto, autorização por destinatário e deduplicação), para uso futuro sem duplicar envios de compras e tarefas.
4. Conectar a análise dos repositórios institucionais e das atividades do Supabase institucional **somente em leitura**, com autorização específica para ações que alterem dados.
