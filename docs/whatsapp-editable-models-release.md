# SAGAMENTE — Liberação dos modelos editáveis de WhatsApp

**PR:** #396 · **Migration proposta:** `20261011220000_whatsapp_editable_templates_and_archive.sql`

## Situação verificada (11/10/2026)

- Projeto Supabase: `PlaySitem-Back`, ref `lfmjqctiutajgtacvxfq`.
- Sem branch de staging registrada no Supabase.
- Última migration registrada no projeto remoto: `20261011134430_wa_switch_delivery_mode_keep_active`.
- A migration `20261011160000_whatsapp_project_notification_copy.sql` não consta do histórico remoto, **mas o corpo da função implantada coincide com o código da migration quando desconsideradas apenas diferenças de espaços e quebras de linha**. A checagem foi feita por consulta somente leitura a `pg_proc.prosrc` e comparação com o arquivo do GitHub em 11/10/2026; não é necessário sobrescrever essa função só para sincronizar a redação.
- **NÃO realizar merge nem aplicar SQL em produção sem reconfirmar o estado real da função, validar backup/restauração e executar testes de integração.**

## Plano seguro de implantação

1. Reconfirmar, no momento da implantação, o estado de `app_private.wa_add_file_link_to_outbox()`, seus gatilhos e o histórico remoto. Foi detectado adicionalmente o gatilho `wa_remover_rodape` antes de `UPDATE OF message_body`; preservá-lo.
2. Registrar a divergência do histórico da migration de padronização sem reaplicá-la desnecessariamente nem inserir um registro falso de execução. Se houver alteração posterior da função, interromper e comparar novamente.
3. Confirmar backup restaurável. Para branch Supabase, consultar custo oficial e obter aprovação antes da criação.
4. Em staging: aplicar a nova migration sobre o estado funcional equivalente verificado; verificar seis registros em `public.wa_message_templates`; autenticar administrador e usuário comum para testar RLS.
5. Testar edição, preview, erro de placeholder, restauração e persistência após recarga.
6. Gerar **novos** avisos autorizados para os estados `project_started`, `stage_completed`, `review_available`, `adjustments_completed`, `final_delivery`. Verificar saída do gerador real, links `/n/...`, arquivos Drive apropriados e preservação de consentimento.
7. Validar histórico: lista compacta, filtros, exportação, arquivar e restaurar. Arquivar não altera `status`, não remove registros nem interrompe fila.
8. Confirmar que o modelo `new_message` é somente configurável nesta etapa; não prometer disparo automático sem integração.
9. Após aprovação funcional e confirmação de backup/restauração, aplicar a nova migration no banco **antes** de fazer merge do frontend. Reexecutar os testes e liberar o PR.

## Recuperação

- Se a UI falhar após publicação: voltar o deploy do frontend para o commit estável anterior.
- Caso haja problema no gerador de texto: restaurar **somente** a versão validada da função `app_private.wa_add_file_link_to_outbox()` a partir do script de migration previamente conferido.
- Preservar as tabelas, configurações salvas e registros arquivados para auditoria; **não** fazer `drop table` ou exclusão de histórico como rollback.
- Registrar horários, responsável técnico, versões e resultados dos testes.

## Restrições

Nenhum envio real, alteração de credenciais ou aplicação SQL no banco de produção faz parte do PR. Checks do GitHub não validam a migration executada no Supabase.
