# Saga — resumo operacional automático independente da RKC

## Escopo
Emissor destinado somente ao cadastro de teste previamente autorizado, identificado no sistema pelo e-mail eufedesigner@gmail.com. O e-mail é apenas identificador, nunca canal de entrega. O destinatário e o telefone são lidos novamente de profiles / user_preferences, sem inserir número fixo. Não se deve incluir outros destinatários sem revisão de acesso.

**Tarefas incluídas na V1:** projetos da Sagamente e serviços de design/Cineclube vinculados ao escopo privado saga_owner_brief_projects. Não incluir tarefas dos projetos RKC ou Pretas Potências, que têm check-ins próprios. O escopo é explícito e pode ser atualizado por administrador de backend, não pelo cliente.

## Entregas e horário
- Fonte única: sagamente_assistant_settings.digest_times, 07:00, 13:00 e 19:00 America/Sao_Paulo.
- A função saga_owner_brief_tick(false) só gera mensagens no minuto exato programado. Monta panorama factual, atrasos, prazos e até quatro prioridades.
- Primeira pessoa: "Conferi", "Preparei". Contagens de concluídas são acumuladas cadastradas, não afirmações de "concluí hoje".
- A notificação é salva para o administrador ativo no Play Sistem. Mensagem WhatsApp exclusiva usa notification e whatsapp_message_outbox com type saga_owner_brief.
- Saga não chama automações rkc_felipe ou automation_enqueue. A função wa_bridge_claim vigente recebe APENAS mais uma cláusula de elegibilidade dinâmica, mantendo todas as demais regras e orçamento.

## Segurança
- saga_owner_brief_settings.enabled começa false; saga assistant enabled=false e whatsapp_notifications=false até homologação.
- saga_owner_brief_runs tem UNIQUE(data, horário, destinatário); tentativa repetida devolve duplicate.
- A elegibilidade é revalidada no momento da retirada pela Baileys: opt-in, telefone, perfil ativo, RLS de backend, tipo da notificação, vínculo à execução, flags da Saga, modo de entrega e disponibilidade geral da ponte.
- Usa limites globais existentes da ponte, inclusive 250/dia, ritmo de 1 min e confirmação via whatsapp_bridge_attempts. Se o administrador pausar a ponte global, a Saga não contorna a pausa.
- Cron saga-owner-brief-minute registrado mas INATIVO inicialmente, até teste e ativação coordenada; não tocar nos cron jobs existentes nem nos avisos da RKC.
- Não ativar flags do stage digest / saga_digest_runtime_controls: este emissor pessoal é independente do estágio de resumos para clientes.

## Estado de testes
Validação SQL reversível: versão da função de ponte vigente detectada por âncora, aplicada aditivamente em transação e revertida. Teste com controles de Saga habilitados temporariamente e ponte habilitada **somente dentro da transação**: enfileiramento liberado, duplicata bloqueada, revogação da chave da Saga impede claim. Rollback confirmou zero outbox de teste.

## Para passar a produção
CI verde; instalar migrações em Supabase, executar um envio real de teste e consultar confirmação de entrega. Só ativar agendamento contínuo após confirmar ponte global ativa e saudável (sem alterar uma pausa global proposital). Resumos aqui no ChatGPT já têm automação própria e independente.
