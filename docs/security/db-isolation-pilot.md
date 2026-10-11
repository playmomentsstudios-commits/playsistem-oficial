# SAGAMENTE — Pacote de validação isolada do banco (Etapa 2)

**Status:** piloto de CI, sem conexão com produção. **NÃO** é staging hospedado, nem aprovação para aplicar migrations no Supabase real.

## Problema de origem (auditoria 11/10/2026)

- `main` está protegida por um ruleset ativo exigindo PR e `Quality Gate`.
- O repositório contém **138 arquivos SQL** de migração em `supabase/migrations`.
- O histórico do projeto Supabase de produção registra **39 migrações**, em grande parte com **versões/timestamps diferentes** dos arquivos locais. Contagem diferente não significa que faltem as mesmas 99 migrações; **não** tentar "corrigir" isso aplicando automaticamente os arquivos.
- Há uma colisão legada no timestamp `20260928173000`, já coberta pelo teste legado do repositório. A colisão impede tratar o histórico local como um replay fiel sem reconciliação.
- Não foi possível autorizar a criação de uma branch hospedada pelo Supabase, pois a consulta obrigatória de custo não estava disponível.

## O que este pacote realmente faz

### 1. Inventário somente leitura

O workflow `DB Isolation Pilot` executa `node scripts/migration-inventory.mjs` na própria branch. Publica a contagem e as colisões no GitHub Actions Step Summary. Não consulta o Supabase remoto e não esconde as colisões históricas.

### 2. Teste em PostgreSQL Supabase local e temporário

Outro job do workflow instala a **Supabase CLI versão 2.81.3**, gera `supabase/config.toml` apenas no diretório temporário do runner, e inicia **somente o banco de dados local** por `supabase db start` em Docker.

A job obtém, diretamente do repositório, o SQL **real** da branch `audit100/sec01-backup-grants` (PR **#355**), registra o commit efetivamente testado e executa:

1. Uma fixture sintética que concede amplos privilégios a `PUBLIC`, `anon` e `authenticated`.
2. A migração original do PR #355 (sem substituí-la por um SQL simulado).
3. Asserções de PostgreSQL reais: RLS ativo; clientes não podem `SELECT`, `UPDATE` nem `TRUNCATE`; `service_role` continua com os privilégios necessários.
4. Reexecução da migração para comprovar idempotência e preservar ACL.
5. Reexecução da migração após remover a tabela opcional, para comprovar que ambiente sem esse backup não quebra.

Depois disso, o container é encerrado com `supabase stop --no-backup`. Os dados de teste não são dados reais; nenhuma credencial Supabase de produção é passada ao workflow.

### 3. Testes Node na CI atual

`tests/migration-inventory-gate.test.mjs` cobre o parser de migrações e a identificação da colisão histórica; é descoberto pelo comando `pnpm test` existente.

## Como acompanhar

- GitHub → Actions → `DB Isolation Pilot`
- Dois checks: `Migration Inventory (advisory)` e `Isolated PostgreSQL - Backup ACL`
- Em cada execução, verificar o commit da migration #355 mostrado no Step Summary. Se a PR mudar, rodar novamente.
- Falha de Docker, imagem, configuração do Supabase CLI ou SQL deve deixar o job **vermelho**, não gerar um falso PASS.

## O que NÃO está validado

- Aplicação de **todas** as 138 migrações, ou compatibilidade integral com o schema remoto.
- Testes integrados dos PRs #359, #362, #351, #352 e outras migrations ainda pendentes (esses mantêm seus testes PostgreSQL/PGlite próprios; serão migrados ao ambiente isolado caso a base seja reconciliada).
- Dados de clientes, fluxos reais de login, Drive, WhatsApp, pagamentos, autenticação de usuários do Supabase hospedado ou deploy Cloudflare.
- Desempenho/segurança da instância de produção.

## Checklist de aceite desta etapa

- [ ] `Quality Gate` da PR do pacote verde (lint, Node, build).
- [ ] `Migration Inventory (advisory)` verde e colisões visíveis no relatório.
- [ ] `Isolated PostgreSQL - Backup ACL` verde e commit do PR #355 registrado.
- [ ] Revisar o diff: não há arquivos de credencial, URLs de banco remoto, `supabase link`, `supabase db push`, `supabase db reset --linked` ou dados reais.
- [ ] Revisar e integrar o PR do pacote (CI ainda não equivale a deploy de migrations).
- [ ] **Somente depois**, planejar a reconciliação histórica em PR próprio para permitir replay integral de schema.

## Operações proibidas neste piloto

Não utilizar `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, `supabase link`, `db push`, `db reset --linked`, `apply_migration` remoto ou `workflow_dispatch` de produção. Se um futuro fluxo exigir segredo real ou custo, encerrar esse piloto e submeter aprovação separada.

Referências: [Supabase Local Development](https://supabase.com/docs/guides/local-development), [Supabase CLI](https://supabase.com/docs/reference/cli/supabase-start), [GitHub PR #355](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/355).
