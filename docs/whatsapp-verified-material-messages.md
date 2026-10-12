# SAGAMENTE — revisão e entrega por WhatsApp

## Diagnóstico confirmado

- Produção: PlaySitem-Back (`lfmjqctiutajgtacvxfq`).
- O capture implantado não selecionava arquivos em revisões de produção.
- O AFTER INSERT implantado sobrescrevia a mensagem, retirava o filtro por pasta, limitava os arquivos principais a seis e restaurava o fallback genérico.
- O modelo editável `stage_completed` ainda continha “Etapa concluída”.
- `notification_id` evitava repetir a mesma notificação, mas não notificações novas do mesmo evento.

## Correção proposta

O capture preserva as opções de preparação, telefone e destino compacto. Um único formatador BEFORE INSERT aplica os modelos editáveis, seleciona arquivos vinculados ao projeto/material/produção, distingue preview/delivery, agrupa títulos e inclui cada URL observada no Drive sem truncar em seis arquivos.

A sincronização consulta os metadados e permissões reais, sem publicar, mover ou apagar objetos. Evidência de acesso é privada ao servidor, expira em 15 minutos e deve corresponder ao nome, ID e pasta. São aceitas permissões públicas existentes ou permissão individual no e-mail de autenticação do destinatário. Grupos/domínios não comprovados são bloqueados.

Arquivos ausentes, privados, vínculos inválidos ou produção incompleta bloqueiam a preparação. A Central permite verificar e preparar somente novos avisos bloqueados, usando a mesma notificação e sem alterar status de materiais. O manifesto é conferido novamente na abertura/claim. Consentimento, seleção de destinatário no claim, intervalo e teto diário permanecem nas funções existentes. No modo single_client, o capture prepara somente o selecionado.

Um índice por destinatário, evento, escopo, status e conjunto/versionamento dos arquivos impede novas cópias do mesmo evento. A fila antiga ainda não enviada é preservada como histórico, sem reenvio. Mensagens já enviadas não são modificadas.

## Piloto real (somente leitura)

Projeto principal: `ed628491-ae22-4ccb-9f91-df56aa2f9a9d`.
Pasta Entregas confirmada: `1Foryi6rbEaxJxf1eXeGtN4ysi-XPyEfQ`.

Os sete JPGs já têm vínculo com os materiais e a produção no Supabase e foram confirmados individualmente no Drive, na pasta Entregas, com permissão existente anyone/reader. Todos permaneciam com client_visible=false. Nenhuma publicação automática foi efetuada.

A pasta real contém também quatro PDFs adicionados posteriormente; a consulta do Supabase ainda não os registrava. A sincronização precisa reconciliar seus IDs reais e os vínculos devem ser definidos explicitamente. Não se inferem vínculos somente pelo nome.

Existe outro projeto “Cineclube Lió Mãe Preta — 1011”. Suas três prévias de cards estavam sem task_id/stage_id. Seus registros não podem ser confundidos com os arquivos finais do projeto principal.

## Validação e implantação

Testes locais: suíte completa, typecheck e build. Os testes exercitam PostgreSQL em PGlite e APIs Drive simuladas, sem sockets ou envios WhatsApp reais.

Aplicação após aprovação da PR:
1. Aplicar a migration 20261012090001.
2. Implantar google-drive-project-sync junto com _shared/whatsappDriveAccess.ts e dependências existentes.
3. Implantar frontend e verificar o build no Cloudflare.
4. Confirmar no Supabase as definições/trigger/índice/evidências implantadas.
5. Conferir/publish explicitamente os arquivos autorizados do piloto, reconciliar PDFs e prévias sem vínculo, e inspecionar a outbox sem envio.
6. Teste real para um único destinatário somente após autorização separada.

Não foi aplicada migration nem Edge Function em produção nesta preparação. Merge/deploy e teste real ainda não são conclusão. O serviço Windows continua usando o claim existente; não foi testado no computador do usuário.
