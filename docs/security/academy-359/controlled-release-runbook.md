# SAGAMENTE — Runbook P0 #359: liberação controlada do recálculo de matrículas

**Situação em 11/10/2026:** PACOTE DE PRÉ-IMPLANTAÇÃO, NÃO AUTORIZAÇÃO DE ALTERAÇÃO REMOTA.

Projeto: `PlaySitem-Back`, Supabase referência `lfmjqctiutajgtacvxfq`.
PR de correção: [#359](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/359). 
Pacote de testes já integrado: [#371](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/371).

## 1. Diagnóstico e evidências já validadas

- Consulta somente leitura no projeto correto: `ACTIVE_HEALTHY`, PostgreSQL 17.
- Nenhuma branch Supabase de homologação existente.
- Versão `20261011060000` **não registrada** na tabela de migrations de produção.
- A função `academy_refresh_enrollment(uuid)` ainda pode ser executada por `anon`. O PR #359 protege identidade/autorização e revoga `PUBLIC`/`anon`.
- Consulta `pg_catalog` demonstrou correspondência textual com as funções históricas do GitHub, após normalizar whitespace, para `academy_refresh_enrollment`, `academy_refresh_my_enrollments`, `academy_issue_my_certificate`.
- Pré-check real executado em modo **read-only**: três resultados `CATALOG_PRECHECK_OK`.
- CI do PR #371 e testes de integração no PostgreSQL isolado aprovados, com fixtures de aluno, admin ativo/inativo, progresso, frequência e certificado.
- `academy_refresh_my_enrollments` e `academy_issue_my_certificate` invocam `academy_refresh_enrollment` preservando a sessão do usuário nos fluxos testados. Chamadas automáticas sem `auth.uid()` não estão homologadas globalmente.
- Consulta somente leitura em 2026-10-11 encontrou 45 versões no ledger remoto; os arquivos locais e o ledger remoto divergem e exigem reconciliação por conteúdo. **Nunca** aplicar o repositório inteiro com `supabase db push` para este PR.
- A disponibilidade de um backup restaurável **NÃO** pôde ser confirmada por estas ferramentas. `ACTIVE_HEALTHY` não equivale a backup.

## 2. Critérios bloqueantes — precisam estar 100% cumpridos

- [ ] **Backup:** abrir Supabase Dashboard → Database → Backups; verificar backup recente, data, retenção, plano e a possibilidade de restaurar. Se não houver backup confiável, criar backup lógico com os meios oficiais, armazenar **fora do GitHub** e validar restauração em instância separada antes de prosseguir. Não presumir backup automático em plano Free.
- [ ] **Recuperação:** definir RPO/RTO aceitáveis, operador de restauração, janela de manutenção e efeitos em novos registros entre backup e recuperação. O backup do banco não inclui objetos binários do Supabase Storage.
- [ ] **Ambiente equivalente:** comprovar um ensaio do fluxo completo em ambiente não produtivo, incluindo ações automáticas/sem `auth.uid()`; a base isolada com schema mínimo é evidência parcial.
- [ ] **Revisão final da migration:** confirmar que o PR #359 ainda está em SHA `3bb14f4423d492ed4b2e1fed4e2a945024174351`. Se mudar, repetir CI e homologação.
- [ ] **Pré-check imediato:** executar somente `docs/security/academy-359/preflight-readonly.sql` no projeto correto; exigir `CATALOG_PRECHECK_OK` para as três funções. Caso haja `STOP_AND_REVIEW`, não aplicar SQL.
- [ ] **Autorização expressa:** registrar responsável pelo deploy, janela de aplicação e consentimento para alterar as permissões do Supabase hospedado.

## 3. Procedimento de implantação (somente após aprovação)

1. Congelar intervenções concorrentes no schema e registrar SHA, versão do SQL e estado atual do banco (somente metadados). Confirmar backup e capacidade de restaurar **antes** de executar comandos de escrita.
2. Usar a **migration exata** do PR #359; não copiar o SQL de um exemplo resumido.
3. Aplicar **uma única migração** pelo mecanismo oficial Supabase com trilha auditável. Como o histórico remoto e local está divergente, não usar `supabase db push` ou `db reset` no projeto hospedado.
4. Registrar o identificador de versão realmente gravado no ledger pela ferramenta de migração. **Não pressupor** que a ferramenta atribuirá o timestamp do nome do arquivo GitHub.
5. Executar `docs/security/academy-359/postflight-readonly.sql`. Exigir para `academy_refresh_enrollment`: `anon=false`, `authenticated=true`, `service_role=true`, `SECURITY DEFINER=true`, `search_path=public` e guarda `auth.uid() is null` presente. Os dois wrappers não podem ter mudado de corpo.
6. Executar testes manuais com usuários de homologação reais e autorização: matrícula própria, matrícula alheia negada, admin ativo/inativo, progresso, presença, emissão e reemissão de certificado, zero notificações duplicadas e chamadas automáticas documentadas. **Nunca** executar funções que mudem matrícula como simples teste de leitura contra clientes reais.
7. Registrar evidências de sucesso e verificar logs de erros 42501 e efeitos de cliente. Manter monitoramento durante a janela combinada.

## 4. Contingência e reversão responsável

- Se o pós-check falhar, interromper a sequência de implantações e escalar para o operador de banco. Não executar repetidamente SQL sobre dados reais para tentar resolver.
- **Preferência: roll-forward de correção**, mantendo a revogação de `anon` e a verificação de identidade. Se uma rotina interna não possuir sessão, corrigir essa chamada com autenticação/autorização apropriada e retestar antes de liberar.
- **Não executar rollback SQL antigo automaticamente:** restaurar a função anterior sem sua guarda reabre o problema de segurança.
- Se houver incidente grave em operações críticas, usar o plano de recuperação validado e aprovado, documentando janela de perda de dados e impacto nos serviços. Uma restauração de snapshot inteiro pode desfazer outras alterações feitas após o backup. Exige decisão humana separada.
- Para eventual reversão de corpo de função, manter uma cópia auditada de `pg_get_functiondef`/grants anteriores em repositório **privado e seguro**, nunca neste PR público, e não restaurar permissões inseguras por padrão.

## 5. Controles que o pacote impõe

- Scripts de `preflight`/`postflight` contêm somente consultas ao catálogo e histórico; não invocam RPC de mutação.
- O manifesto `release-manifest.json` permanece `approval_to_apply_in_production=false`. Apenas editar documentação/JSON não é autorização para executar DDL.
- `P0 Academy Release Readiness` roda checks de integridade do pacote sem segredos e recusa mudança silenciosa no SHA do PR #359.
- Merge deste **pacote preparatório** por si só não corrige o banco, e pode acionar o deploy do Worker; manter PR aberto até a revisão e autorização do merge.
- Histórico das migrações continua pendente na [issue #368](https://github.com/playmomentsstudios-commits/playsistem-oficial/issues/368).

## 6. Conclusão / aceite

- [x] Estado inicial de produção conferido por leitura.
- [x] Funções de referência e dependências identificadas.
- [x] CI e testes de integração em banco isolado aprovados.
- [x] Pré-check de produção em modo leitura aprovado.
- [x] Procedimento de pós-verificação documentado.
- [ ] Backup restaurável e estratégia de recuperação validados.
- [ ] Homologação de chamadas automáticas fora dos fluxos de aluno e admin concluída.
- [ ] Janela/autorização explícita registradas.
- [ ] Migração aplicada em produção e resultado pós-check comprovado.

**Este pacote é uma preparação segura para a implantação, não a implantação em si.**
