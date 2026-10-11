# SAGAMENTE — Liberação dos modelos editáveis de WhatsApp

**PR:** #396 · **Migration proposta:** `20261011215447_whatsapp_editable_templates_and_archive.sql`

## Situação verificada (11/10/2026)

**Migration aplicada com sucesso no banco de produção** via Supabase; versão registrada `20261011215447_whatsapp_editable_templates_and_archive`. Os seis modelos, as funções RPC e as colunas de arquivamento foram confirmados em consulta somente leitura. Os 61 registros anteriores estavam preservados após a aplicação. Nenhuma mensagem real de WhatsApp foi enviada no teste.

- Projeto Supabase: `PlaySitem-Back`, ref `lfmjqctiutajgtacvxfq`.
- Sem branch de staging registrada no Supabase. A tentativa de criar `sagamente-whatsapp-pr396-staging` foi bloqueada com `PaymentRequiredException`: branching exige plano Pro ou superior; organização Play Moments está no Free.
- Última migration registrada no projeto remoto: `20261011134430_wa_switch_delivery_mode_keep_active`.
- A migration `20261011160000_whatsapp_project_notification_copy.sql` não consta do histórico remoto, **mas o corpo da função implantada coincide com o código da migration quando desconsideradas apenas diferenças de espaços e quebras de linha**. A checagem foi feita por consulta somente leitura a `pg_proc.prosrc` e comparação com o arquivo do GitHub em 11/10/2026; não é necessário sobrescrever essa função só para sincronizar a redação.
- A nova migration foi aplicada após CI #778, teste PGlite de aplicação/reversão e preparação de rollback da função. O staging de nuvem não pôde ser criado no plano Free; o rollback não substitui um backup integral do banco.

## Plano seguro de implantação

1. Reconfirmar, no momento da implantação, o estado de `app_private.wa_add_file_link_to_outbox()`, seus gatilhos e o histórico remoto. Foi detectado adicionalmente o gatilho `wa_remover_rodape` antes de `UPDATE OF message_body`; preservá-lo.
2. Registrar a divergência do histórico da migration de padronização sem reaplicá-la desnecessariamente nem inserir um registro falso de execução. Se houver alteração posterior da função, interromper e comparar novamente.
3. Confirmar backup restaurável. Custo oficial de branch consultado: **US$ 0,01344/hora**; mesmo após confirmação, a criação falhou porque o Supabase exige Pro ou superior. **Não contratar plano nem criar outra instância sem autorização explícita.**
4. Testar em PostgreSQL isolado (PGlite, já coberto por testes automatizados) e, se for disponibilizado staging real, aplicar a nova migration sobre o estado funcional equivalente verificado; verificar seis registros em `public.wa_message_templates`; autenticar administrador e usuário comum para testar RLS.
5. Testar edição, preview, erro de placeholder, restauração e persistência após recarga.
6. Gerar **novos** avisos autorizados para os estados `project_started`, `stage_completed`, `review_available`, `adjustments_completed`, `final_delivery`. Verificar saída do gerador real, links `/n/...`, arquivos Drive apropriados e preservação de consentimento.
7. Validar histórico: lista compacta, filtros, exportação, arquivar e restaurar. Arquivar não altera `status`, não remove registros nem interrompe fila.
8. Confirmar que o modelo `new_message` é somente configurável nesta etapa; não prometer disparo automático sem integração.
9. Migration de produção aplicada e verificada em 11/10/2026; após atualizar a branch e obter Quality Gate verde, liberar o merge do frontend e acompanhar o deploy Cloudflare. Realizar smoke test do painel autenticado. Reexecutar os testes e liberar o PR.

## Recuperação

- Se a UI falhar após publicação: voltar o deploy do frontend para o commit estável anterior.
- Caso haja problema no gerador de texto: restaurar **somente** a versão validada da função `app_private.wa_add_file_link_to_outbox()` usando `docs/rollbacks/whatsapp-pr396-restore-message-builder.sql`. O script foi obtido da migration equivalente à função atualmente em produção.
- Preservar as tabelas, configurações salvas e registros arquivados para auditoria; **não** fazer `drop table` ou exclusão de histórico como rollback.
- Registrar horários, responsável técnico, versões e resultados dos testes.

## Restrições

Nenhum envio real de WhatsApp ou alteração de credenciais foi executado. A migration foi aplicada no banco de produção após testes isolados e salvaguarda de rollback. Checks do GitHub não validam a migration executada no Supabase.
