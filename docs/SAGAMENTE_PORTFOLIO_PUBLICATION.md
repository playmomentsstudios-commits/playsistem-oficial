# SAGAMENTE — portfólio a partir de projetos 100% concluídos

A ficha de portfólio só pode ser originada de um projeto operacional do painel administrativo. O projeto deve estar marcado como Concluído e possuir tarefas reais: todas as tarefas não canceladas e todos os checklists concluídos. O percentual deve ser 100%.

O gestor do site seleciona um projeto elegível, prepara título, capa, categoria e resumo publicável. Por padrão, o material fica como rascunho. A publicação no site é uma ação explícita do editor, nunca automática.

A consulta pública passa por uma função SQL que verifica o status das tarefas e checklists em tempo real no banco. Reabrir o projeto ou criar uma nova tarefa pendente oculta automaticamente o trabalho publicado. A função pública não expõe os IDs dos projetos internos, tarefas, clientes internos, arquivos ou informações financeiras.

A exclusão do projeto de origem elimina o vínculo; a ficha do portfólio fica oculta para revisão, mantendo sua descrição.

A página Quem Somos mantém o portfólio invisível enquanto não existem fichas prontas e aprovadas. Testar como visitante anônimo, usuário autenticado e administrador.
