# RKC — reconciliação de check-ins por voz (V1)
Data: 15/10/2026. Projeto Play: `33706aee-6c49-48fb-aa8d-1de3cfce01a9`.

## Implementado no Supabase PlaySitem-Back
- Migration `rkc_checkin_reconciliation_v1`, espelhada em `004_rkc_checkin_reconciliation.sql`.
- Tabela `rkc_checkin_reviews` com RLS, sem permissão de escrita direta por cliente.
- `rkc_checkin_prepare`: sessão admin obrigatória, idempotência, valida IDs e status atuais, requer confirmação explícita para concluir tarefa ou checklist.
- `rkc_checkin_apply`: segunda ação de aprovação admin, revalida estado anterior, aplica atomicamente alterações de status/checklist e registra o resultado.
- Não altera ponte WhatsApp, regras de notificação, Drive ou os 27 itens de produção por conta própria.

## Teste real e verificável
- Inserida uma revisão técnica com **zero mudanças** no projeto RKC: `a9a907fb-74c7-4966-b352-267b66b17906`.
- A leitura confirmou `status=draft`, `changes=0` e vínculo ao projeto correto.
- Antes/depois: 27 tarefas, 0 concluídas.
- `anon` sem EXECUTE nas RPCs; `authenticated` pode invocar, mas as funções exigem `auth.uid()` e `current_user_is_admin()`.
- Nenhum arquivo movido ou enviado; nenhum WhatsApp disparado neste teste.

## Fluxo operacional para concluir
1. Criar interface de revisão no admin ou integrar ao consumidor ChatGPT Work autenticado com sessão admin. Nunca enviar service_role ao navegador.
2. Ler tarefas, checklist, links e arquivos do projeto, cruzar com relato transcrito.
3. Mostrar proposta de alterações e divergências ao usuário; aprovação explícita.
4. Executar `rkc_checkin_prepare` e `rkc_checkin_apply` com credenciais de administrador válidas; verificar alterações.
5. Atualizar etapas/progresso conforme regra real do painel (ainda não implementado nesta migration).
6. Para Drive: verificar metadados, permissões, hash/tamanho e existência do arquivo; vincular `task_links`/`client_files` só após confirmação. Não há upload automatizado nesta versão.
7. Gerar relatório consultivo e chamar fluxo WhatsApp existente apenas após número empresarial confirmado e sincronização bem-sucedida. O módulo `automation-notifications` anterior já teve teste `delivered` no telefone pessoal do usuário; isso não comprova envio empresarial.
8. Testar com uma alteração real não crítica **apenas após relato e confirmação**. Nunca usar o 2º Prêmio como teste de conclusão.

## Limitações
A migration **não é integração automática do ChatGPT com o Play Sistem**. Não há webhook autenticado de relatórios de voz, interface de aprovação, leitura/gravação de Drive ou dispatch pós-check-in encadeado nesta entrega. O fluxo completo precisa desses componentes para operar sem intervenção.
