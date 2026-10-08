# Vínculo posterior de cliente a projeto

## Funcionalidade
- **Administração → Projetos → Abrir projeto**: escolher cliente existente, vincular, trocar ou remover. A confirmação descreve a alteração de acesso.
- **Administração → Clientes → Abrir cliente → Projetos**: escolher um projeto **externo ainda sem cliente** e associá-lo à conta.
- O cliente vê o projeto em **Minha Conta → Projetos**. Etapas, tarefas, links e arquivos continuam obedecendo suas próprias políticas e flags `client_visible`.
- Projetos `project_type='internal'` não aceitam vínculo com cliente. Não converter automaticamente projetos internos.
- Apenas clientes com `role='customer'` e `status='active'` podem receber um novo vínculo. A alteração é restrita a usuários com permissão `projects.manage` via RLS.
- Uma atualização concorrente não é sobrescrita silenciosamente (comparação do `customer_id` anterior no filtro `UPDATE`).

## Banco de dados — implantação já aplicada
Projeto Supabase `lfmjqctiutajgtacvxfq`. Migration registrada: `link_existing_customer_to_project_and_sync_files`.

Ela criou, no schema **não exposto** `app_private`:
- Trigger `projects_validate_customer`: valida conta ativa de cliente em alteração de vínculo.
- Trigger `projects_sync_customer_files`: acompanha alterações de `projects.customer_id` / `project_type` e sincroniza `client_files.customer_id`, preservando `client_visible` para projetos externos; ao tornar interno, mantém arquivos privados.
- Índice `idx_client_files_project_id`.
- Política `projects_read` exige conta de cliente ativa para leitura por proprietário. Admin/staff mantêm seus critérios atuais.

Não é necessário criar tabela associativa: o domínio atual suporta **um cliente responsável por projeto**. Vários visualizadores distintos exigiriam modelagem e políticas próprias.

## Verificação
Teste transacional concluído com `ROLLBACK`: criar projeto, inserir arquivo privado, vincular cliente A, tornar o arquivo público, transferir para cliente B, remover cliente e tornar projeto interno. Confirmou sincronização e privacidade do arquivo. Nenhum projeto real foi modificado por esse teste.

## Casos de aceite após deploy
1. Criar projeto externo sem cliente e cadastrar o cliente depois.
2. Vincular pelo detalhe do projeto; conferir em `/app/projetos` com a conta desse cliente.
3. Vincular pela ficha de um cliente com projeto externo sem cliente.
4. Trocar o cliente e garantir que o anterior deixe de ter acesso e arquivos `client_visible` sejam recebidos apenas pelo novo.
5. Desvincular e garantir que o projeto desapareça do portal antigo.
6. Projeto interno não permite vínculo.
7. Cliente inativo/bloqueado não pode receber novo vínculo.
8. Usuário sem `projects.manage` não consegue salvar.
9. Testar cadastro com muitos clientes, erro de carregamento e concorrência.

## Atenção
- O vínculo com o projeto **não** torna automaticamente visível conteúdo interno. Revise a descrição do projeto e as flags antes de compartilhar.
- Criação de pasta no Drive é best-effort e não impede o vínculo. Conferir o Drive separadamente.
