# SAGAMENTE — Liberação dos modelos editáveis de WhatsApp

**PR:** #396 · **Migration proposta:** `20261011220000_whatsapp_editable_templates_and_archive.sql`

## Situação verificada (11/10/2026)

- Projeto Supabase: `PlaySitem-Back`, ref `lfmjqctiutajgtacvxfq`.
- Sem branch de staging registrada no Supabase.
- Última migration registrada no projeto remoto: `20261011134430_wa_switch_delivery_mode_keep_active`.
- Migration fonte necessária `20261011160000_whatsapp_project_notification_copy.sql` não consta do histórico remoto.
- **NÃO realizar merge nem aplicar SQL em produção sem conciliar o histórico e validar backup/restauração.**

## Plano seguro de implantação

1. Verificar estado real de `app_private.wa_add_file_link_to_outbox()`, gatilhos e histórico `supabase_migrations.schema_migrations`.
2. Reconciliar as migrations pendentes, especialmente a versão de padronização de texto de 11/10, antes desta nova migration. Não marcar migrations como aplicadas sem conferir seu conteúdo.
3. Confirmar backup restaurável. Para branch Supabase, consultar custo oficial e obter aprovação antes da criação.
4. Em staging: aplicar migrations na ordem; verificar seis registros em `public.wa_message_templates`; autenticar administrador e usuário comum para testar RLS.
5. Testar edição, preview, erro de placeholder, restauração e persistência após recarga.
6. Gerar **novos** avisos autorizados para os estados `project_started`, `stage_completed`, `review_available`, `adjustments_completed`, `final_delivery`. Verificar saída do gerador real, links `/n/...`, arquivos Drive apropriados e preservação de consentimento.
7. Validar histórico: lista compacta, filtros, exportação, arquivar e restaurar. Arquivar não altera `status`, não remove registros nem interrompe fila.
8. Confirmar que o modelo `new_message` é somente configurável nesta etapa; não prometer disparo automático sem integração.
9. Após aprovação funcional, aplicar a migration no banco **antes** de fazer merge do frontend. Reexecutar os testes e liberar o PR.

## Recuperação

- Se a UI falhar após publicação: voltar o deploy do frontend para o commit estável anterior.
- Caso haja problema no gerador de texto: restaurar **somente** a versão validada da função `app_private.wa_add_file_link_to_outbox()` a partir do script de migration previamente conferido.
- Preservar as tabelas, configurações salvas e registros arquivados para auditoria; **não** fazer `drop table` ou exclusão de histórico como rollback.
- Registrar horários, responsável técnico, versões e resultados dos testes.

## Restrições

Nenhum envio real, alteração de credenciais ou aplicação SQL no banco de produção faz parte do PR. Checks do GitHub não validam a migration executada no Supabase.
