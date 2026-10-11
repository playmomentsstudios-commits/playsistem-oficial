# SAGAMENTE — Reconciliação somente leitura das migrações (11/10/2026)

**Operação #368 · Não aplicar migrações em produção.**

## Fontes e limites
- Repositório público `playmomentsstudios-commits/playsistem-oficial`, branch `main`: 138 arquivos SQL em `supabase/migrations`.
- Projeto Supabase `lfmjqctiutajgtacvxfq`: consulta **somente leitura** a `list_migrations`, com 39 registros de versão e nome. Snapshot de metadados em `docs/security/remote-migration-metadata-2026-10-11.json`. Este arquivo não contém clientes, tokens, passwords nem conteúdo SQL.
- Executado diagnóstico **somente leitura** de 7 funções `SECURITY DEFINER` relevantes por `pg_catalog`; todas permanecem com `anon EXECUTE=true` na produção. Isso mostra privilégios efetivos, não comprova exploração. As correções propostas continuam em PRs separados.

## Resultado reproduzível
| Critério | Encontrado |
|---|---:|
| Arquivos de migração locais | 138 |
| Registros de migração do banco remoto | 39 |
| Correspondência exata por timestamp | **0** |
| Correspondência somente por nome (timestamp diferente) | **26** |
| Migrações remotas sem nome/timestamp correspondente | **13** |
| Timestamps locais inválidos como data/hora calendário | **6** |
| Timestamps locais duplicados | **1** |

**Não está reconciliado.** Nenhuma das 26 coincidências de nome demonstra SQL equivalente. Nenhum dos 138 SQL deve ser aplicado automaticamente. Os 13 registros remotos restantes podem representar migrações feitas pelo painel ou nomes divergentes; não assumir ausência da estrutura.

### Seis versões que não são timestamps de calendário válidos
- `20260926240000_admin_operational_settings.sql`
- `20260926250000_operational_notifications_preferences.sql`
- `20260926260000_site_settings_cms.sql`
- `20260926270000_crm_automatic_follow_up.sql`
- `20260926280000_customer_avatar_storage.sql`
- `20260929007000_academy_rbac_governance.sql`

A colisão pré-existente é `20260928173000`, utilizada em `academy_2_certificates_cohorts.sql` e `public_digital_literacy.sql`. Há também uma versão posterior `20260928174000_public_digital_literacy.sql`. Investigar se houve reparo histórico antes de qualquer renumeração.

### Treze migrações remotas não coincidentes sequer por nome
1. `create_kv_table_89b8ead1`
2. `consolidate_cineclube_oct_nov_first_package_backup`
3. `sagamente_institutional_branding_20261008`
4. `portfolio_completed_projects_only_20261008`
5. `sagamente_brand_identity_center_20261008`
6. `link_existing_customer_to_project_and_sync_files`
7. `seo_center_phase1_sagamente`
8. `pwa_push_v1_notifications`
9. `zero_cost_priority_alerts_live_sync`
10. `project_stage_detail_and_notifications_20261010`
11. `whatsapp_stage_notification_deeplinks_20261010`
12. `customer_task_specific_notifications_20261010`
13. `wa_truthful_project_status_copy`

As correspondências por aproximação textual (ex.: prefixos e sufixos) NÃO são computadas como equivalentes; exige-se SQL aplicado e schema efetivo para confirmar.

## Correções P0 pendentes no banco real

Consulta `pg_catalog` somente leitura confirmou `SECURITY DEFINER=true` e privilégio `EXECUTE` de `anon` para as seguintes funções: `academy_accept_document`, `academy_refresh_enrollment`, `academy_refresh_program_enrollment`, `admin_set_member_role`, `release_order_stock`, `submit_file_review` e `submit_file_review_v2`.

Não é motivo para rodar SQL diretamente. As alterações devem ser testadas em uma reconstrução equivalente ou em fixtures direcionadas, revisadas, implantadas com backup e monitoradas. Os PRs #362, #359, #352, #356, #361 e #363 tratam partes dessas permissões.

## Execução sem credenciais

```bash
node scripts/reconcile-migration-history.mjs --remote docs/security/remote-migration-metadata-2026-10-11.json --output migration-drift.json
node --test tests/migration-reconciliation-readonly.test.mjs
```

O GitHub Actions `Migration Drift Audit` executa essas verificações com permissões `contents:read`, sem token Supabase, sem conexão ao banco, sem acesso a dados de clientes e sem deployment. Produz resumo legível e um relatório JSON temporário.

## Checklist de liberação para etapa posterior
- [x] Comparar metadados GitHub e Supabase por consulta somente leitura.
- [x] Registrar 6 datas inválidas e colisão de versão existente.
- [x] Classificar os 39 registros por equivalência de versão/nome de forma conservadora.
- [x] Consultar privilégios das sete RPCs prioritárias sem modificar a produção.
- [ ] Comprovar equivalência do SQL aplicado por revisão de DDL, não somente de nomes.
- [ ] Investigar 13 migrations remotas sem correspondente textual.
- [ ] Projetar baseline local representativo e o replay integral em PR separado.
- [ ] Aprovar revisão e só depois planejar implantação escalonada dos PRs de segurança.

**Regras:** sem `db push`, `supabase link`, `db reset --linked`, `apply_migration` remoto ou alteração automática da tabela de histórico. Não mudar timestamps usados em produção sem uma análise dos impactos e sem consentimento.
