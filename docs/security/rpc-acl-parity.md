# SAGAMENTE — Pacote de teste de permissões críticas (11/10/2026)

## Objetivo
Comparar o estado de privilégios das funções relevantes do Supabase em produção (**somente leitura**) com o efeito esperado das migrações corretivas já abertas em PR. Não aplicar SQL na produção nem declarar homologação integral de regras de negócio.

## Como o teste funciona
- `docs/security/rpc-access-readonly.sql` é a consulta de observação: lista somente assinatura, `SECURITY DEFINER`, configurações de busca, flags de permissões e uma impressão digital MD5 do corpo (não retorna código nem dados pessoais).
- O workflow `Sensitive RPC Access Gate` sobe um **PostgreSQL temporário** em Docker com Supabase CLI `2.81.3`, sem token ou vínculo com projeto hospedado.
- O ambiente monta **apenas três assinaturas sintéticas** de funções, inicialmente concedidas a `PUBLIC`, `anon`, `authenticated` e `service_role`.
- Obtém via GitHub o SQL real e conferido por SHA dos PRs **#356** (estoque) e **#361** (revisão de arquivos). Se o commit de qualquer PR mudou, o teste **falha**, exigindo inspeção antes de atualizar o SHA.
- Verifica ACLs reais com `has_function_privilege` e `aclexplode`, incluindo privilégios herdados de `PUBLIC`, e repete as migrações para comprovar idempotência.
- Encerra o container com `supabase stop --no-backup`. Não há execução de `db push`, `apply_migration` remoto ou deploy Cloudflare.

## Matriz esperada **após implantar** as migrações

| RPC | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE | Ref. |
|---|---|---|---|---|
| `release_order_stock(uuid)` | Não | Não | Sim | #356 |
| `submit_file_review(uuid,text,text)` | Não | Sim | Sim | #361 |
| `submit_file_review_v2(uuid,text,text,text,jsonb,jsonb)` | Não | Sim | Sim | #361 |

**A matriz acima é o resultado exigido nas fixtures locais, não o estado atual em produção.** A consulta de leitura da instância hospedada confirmou que as funções sensíveis do inventário anterior ainda não receberam o endurecimento de ACL.

## Limitações e dependências
- As funções sintéticas não contêm os efeitos reais em estoque, chat ou arquivos. O teste comprova revogações/concessões por assinatura, não as regras internas de negócio, autorização por usuário, ou compatibilidade integral com RLS remoto.
- PR **#362** (`admin_set_member_role`) já tem testes PGlite com usuários anônimo/admin ativo/inativo, mas exige homologação funcional e planejamento de implantação.
- PR **#359** (`academy_refresh_enrollment`) exige validação adicional dos fluxos internos: a leitura de dependências do `pg_catalog` encontrou `academy_issue_my_certificate` e `academy_refresh_my_enrollments` chamando a rotina. A nova exigência de `auth.uid()` pode alterar o comportamento de chamadas internas sem identidade de sessão. **Não aprovar implantação até mapear essas chamadas**. Isto é um risco potencial, não uma falha comprovada.
- PRs #352 e #363 também dependem de testes de fluxos da Academia além de isolamento de ACL.
- Histórico `main`/Supabase ainda não foi reconciliado (PR #369).
- O teste não executa SQL em produção nem mexe em arquivos Drive/WhatsApp.

## Checklist do pacote
- [ ] `Quality Gate` do PR desta etapa aprovado.
- [ ] `Isolated PostgreSQL - Sensitive RPC ACLs` aprovado.
- [ ] Efeito de ACL esperado para os três RPCs e idempotência confirmados.
- [ ] Fonte exata dos PRs #356 e #361 vinculada a SHA aprovado.
- [ ] Produção, `main` e credenciais inalteradas.
- [ ] Revisar antes de merge: `main` protegida; merge dispara deploy Cloudflare.
- [ ] Próximo pacote: revisar dependências e autoria dos PRs #359/#352/#363, montar fixtures sem dados reais e confirmar autorização funcional.

## Fontes oficiais e evidências
- [PR #356](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/356), [PR #361](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/361).
- [PR #367 — Piloto isolado](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/367).
- [PR #369 — Reconciliação do histórico](https://github.com/playmomentsstudios-commits/playsistem-oficial/pull/369).

Este é um **pacote de validação**: não altera o schema hospedado nem corrige funções de produção.
