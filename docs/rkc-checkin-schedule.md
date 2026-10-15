# Teste RKC — segunda a sábado

Horários recuperados da automação existente “Check-ins e editais RKC”: 08h, 13h e
18h, America/Sao_Paulo. Sua recorrência no ChatGPT foi atualizada para segunda a
sábado, preservando as instruções de pesquisa e check-in.

No WhatsApp, a agenda usa o próprio backend Supabase. `automation_schedules` guarda
horários, dias, fuso, projeto e ativação. O cron `play-rkc-checkin-test` acorda a cada
hora e `app_private.rkc_checkin_tick` só enfileira nos três horários locais, de
segunda a sábado. Nenhum outro cron ou configuração da ponte foi alterado.

A mensagem varia conforme o horário (início do dia, balanço da manhã, fechamento)
e inclui até cinco pendências abertas do projeto RKC, com seus prazos cadastrados.
Não inventa novidade de edital nem confirma tarefas como concluídas. A origem do
evento é identificada como play_sistem_scheduler. O resultado completo produzido
pela pesquisa da automação do ChatGPT não é encaminhado ao WhatsApp nesta versão.

A fila, o consentimento, os limites e os comprovantes existentes são reutilizados.
A chave rkc:scheduled:AAAA-MM-DD:HH impede duplicidade. Pausar o flow RKC no painel
impede novos disparos agendados. Eventos já enfileirados seguem as regras da fila.
A ponte local deve permanecer ligada/conectada. Se o preflight falhar no horário,
o evento registra o erro e não é reproduzido silenciosamente em outro momento.

Migration aplicada: 20261015152132_rkc_checkin_schedule.sql. Job e agenda confirmados
ativos. Simulações sem disparo em produção aceitaram quinta-feira às 13h e sábado
às 08h e rejeitaram domingo. Nenhum envio extra foi executado na configuração.
Primeiro horário seguinte à ativação: 15/10/2026 às 13h (Brasília).

Teste PGlite cobre horários locais, exclusão de domingos e horários intermediários,
preview sem envio, exclusão de tarefas concluídas, deduplicação, pausa e permissões.
O teste foi validado localmente. A função é SECURITY INVOKER, search_path vazio,
executável somente por postgres/service_role; a tabela tem RLS e leitura só admin.
Não existe data de encerramento presumida: o teste continua até ser pausado.
