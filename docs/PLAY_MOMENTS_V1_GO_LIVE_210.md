# Play Moments V1 — Go-Live Gate (#210)

Este documento é a linha de chegada operacional da V1. Uma melhoria futura não bloqueia lançamento; somente itens marcados como **BLOQUEADOR** impedem o go-live.

## Regra de decisão

- **PASSOU**: validado em ambiente equivalente à produção.
- **VALIDAR**: existe no código, mas ainda precisa de prova operacional.
- **BLOQUEADOR**: falha impede cliente, equipe, dinheiro, segurança ou entrega.
- **BACKLOG**: melhoria útil que não impede operar.

A V1 pode ser liberada quando houver **zero BLOQUEADOR**, CI/build verdes e as jornadas críticas abaixo estiverem PASSOU.

## 1. Infraestrutura e produção

| Gate | Critério | Estado inicial |
|---|---|---|
| Build | typecheck, testes e build passam | VALIDAR no CI do #210 |
| Deploy | produção abre sem erro fatal | VALIDAR |
| Supabase | migrations exigidas até #203/#199 conferidas no remoto | VALIDAR |
| Drive | upload, leitura e permissão funcionam com conta real | VALIDAR |
| Arquivos novos | binários novos seguem Drive, não Supabase Storage | IMPLEMENTADO |
| Pagamentos | credencial de produção + webhook + compra ponta a ponta | BLOQUEADOR até prova real |
| Domínio | domínio oficial, HTTPS e canonical corretos | VALIDAR |
| Recuperação | backup/tag da versão de produção registrado | FAZER APÓS HOMOLOGAÇÃO |

## 2. Jornada do cliente

1. Visitante entende a oferta e navega em produto/serviço/Academia.
2. Cadastro, confirmação, login e recuperação de senha.
3. Compra ou contratação cria registro correto e leva ao pagamento.
4. Pagamento muda estado por confirmação real do provedor.
5. Pedido/projeto aparece para cliente e Admin.
6. Cliente recebe comunicação e consegue responder.
7. Arquivos do projeto ficam acessíveis com autorização correta.
8. Entrega/conclusão preserva histórico.
9. Cliente não enxerga dados de outro cliente.

Qualquer falha nos itens 2–5 ou 9 é **BLOQUEADOR**.

## 3. Jornada da Academia

1. Curso publicado aparece para o público/aluno correto.
2. Matrícula abre a área acadêmica.
3. Aula registra progresso.
4. Atividade/avaliação registra resultado conforme regra configurada.
5. Frequência é considerada quando exigida.
6. Conclusão só ocorre quando os requisitos acadêmicos forem atendidos.
7. Boletim/histórico/documentos refletem o estado acadêmico.
8. Certificado só fica disponível quando elegível.
9. Aluno não acessa matrícula/documentos de outro aluno.

Falhas de autorização, conclusão indevida ou documento incorreto são **BLOQUEADOR**.

## 4. Jornada do colaborador

Criar contas de homologação separadas. Nunca homologar permissões usando somente a conta Administrador.

- Comercial: clientes, catálogo, vendas, orçamentos e atendimento.
- Operações: projetos, tarefas, arquivos e atendimento.
- Financeiro: pagamentos e relatórios; sem edição de Site/Academia.
- Produção criativa: projetos/arquivos/conversas necessários à execução.
- Atendimento: conversas, clientes e leitura de vendas/orçamentos.
- Academia: começar com permissões acadêmicas explícitas conforme função.
- Administrador: acesso integral e ações de governança.

Para cada perfil testar **permitido e negado**. Menu oculto não é prova suficiente: acesso direto pela URL e RLS/API também devem negar quando aplicável.

## 5. Matriz mínima de permissões

| Papel | Clientes | Vendas/Orç. | Projetos/Arquivos | Conversas | Financeiro | Catálogo | Academia | Site/Gestão |
|---|---|---|---|---|---|---|---|---|
| Admin | total | total | total | total | total | total | total | total |
| Comercial | leitura/gestão | gestão | — | gestão | — | gestão | — | — |
| Operações | leitura/gestão | leitura | gestão | gestão | leitura/relat. | leitura | — | — |
| Financeiro | leitura | leitura | — | — | gestão | — | — | — |
| Produção | leitura | — | gestão | atribuídas | — | leitura opc. | — | — |
| Atendimento | leitura | leitura | — | gestão | — | — | — | — |
| Academia | conforme função | — | arquivos somente se necessário | — | — | — | permissões explícitas | — |

A tabela é baseline de menor privilégio. Ajustes individuais devem ser deliberados, não acesso total por conveniência.

## 6. Testes críticos antes do lançamento

Executar pelo menos uma vez em navegador desktop e uma vez em viewport mobile:

- público → cadastro → login;
- produto → carrinho → checkout → pagamento;
- serviço → contratação/orçamento → Admin → cliente;
- mensagem cliente ↔ equipe;
- projeto → arquivo Drive → cliente;
- colaborador permitido + colaborador negado;
- Academia: matrícula → aula → avaliação → conclusão → documento/certificado;
- recuperação de senha;
- sessão expirada;
- erro de rede/retry nas jornadas de dinheiro e entrega.

## 7. Observabilidade e operação

Antes do tráfego real deve existir uma forma objetiva de responder:
- o checkout está falhando?
- webhook de pagamento está chegando?
- uploads Drive estão falhando?
- autenticação está falhando?
- qual jornada gera abandono?

Não registrar conteúdo privado, senha, token, número completo de cartão ou documento pessoal em analytics/logs.

## 8. Critério de encerramento da V1

A V1 está **LIBERADA PARA OPERAÇÃO** quando:

1. zero BLOQUEADOR;
2. testes/build verdes;
3. pagamentos reais homologados;
4. Drive homologado;
5. matriz de colaboradores testada com contas não-admin;
6. jornada cliente e Academia passam ponta a ponta;
7. produção/domínio/credenciais conferidos;
8. backup/tag final criado.

Depois disso, novas ideias entram em **V1.1/V1.2**, sem segurar a operação.
