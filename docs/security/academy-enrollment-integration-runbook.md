# SAGAMENTE — Homologação da Academia (pacote PR #359)

**Status:** testes funcionais em PostgreSQL isolado, sem alterações na produção.

## O que está sendo testado
- Migração **exata** do [PR #359](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/359), obtida do commit fixado `3bb14f4423d492ed4b2e1fed4e2a945024174351`.
- Duas funções que chamam `academy_refresh_enrollment`: `academy_refresh_my_enrollments()` e `academy_issue_my_certificate(uuid)`. O workflow extrai suas definições diretamente das migrações **existentes no GitHub**, em vez de usar apenas mocks simplificados.
- O banco PostgreSQL é criado com **Supabase CLI 2.81.3** em Docker, com usuários, cursos, presença, progresso e avaliação inteiramente fictícios.

## Testes de segurança e continuidade
- [ ] `anon`: não consegue invocar recálculo direto nem ver matrículas em nome próprio sem sessão.
- [ ] `service_role` sem identidade de usuário: operação direta rejeitada, embora o GRANT permita execução.
- [ ] Usuário autenticado diferente do titular: operação rejeitada sem alterar matrícula.
- [ ] Administrador inativo: operação rejeitada sem alterar matrícula.
- [ ] Aluno titular: recálculo preserva progresso de 100%, presença de 100% e nota final 80.
- [ ] Rotina de matrículas do próprio aluno retorna somente sua matrícula.
- [ ] Emissão e reemissão de certificado funcionam para o aluno elegível.
- [ ] Emissão não duplica certificado, notificação nem evento de conclusão.
- [ ] Administrador ativo mantém permissão para recalcular matrícula de outro aluno.
- [ ] Falha de SQL ou de extração de funções interrompe a CI; a instância temporária é encerrada sem backup.

## Limitações relevantes
**O GitHub é a fonte das definições de wrappers neste teste, não o Supabase de produção.** Como o histórico local/remoto ainda não foi reconciliado (PR #369), **não é possível atestar identidade binária nem equivalência funcional de todo o schema de produção**. Este teste complementa os testes PGlite existentes no PR #359, mas não substitui testes reais de usuário no sistema implantado, nem valida fluxos de serviço/agendamentos que chamem recálculo sem `auth.uid()`.

O teste não importa dados de clientes, não acessa o banco remoto, não usa credenciais do Supabase, não executa `supabase link`, `db push` ou `apply_migration`, e não envia mensagens reais.

## Próximo checklist depois dos testes
1. Conferir os dois workflows verdes no PR desta etapa: `Quality Gate` e `Academy Enrollment Integration`.
2. Revisar se os wrappers do repositório ainda correspondem aos handlers reais, comparando metadados/DDL por método autorizado de leitura, sem expor dados.
3. Identificar triggers e rotinas automáticas internas que usem a função de recálculo sem sessão.
4. Fazer ensaio completo em staging seguro ou ambiente reproduzido antes de autorizar o PR #359 no Supabase de produção.
5. Exigir backup, janela de implantação e plano de reversão antes de qualquer migração real.

**Nunca confundir CI aprovada com implantação concluída.**
