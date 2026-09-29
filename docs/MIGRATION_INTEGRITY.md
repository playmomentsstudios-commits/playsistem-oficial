# Integridade do histórico de migrations

## Colisão histórica conhecida — 20260928173000

A main contém duas migrations históricas com o prefixo `20260928173000`:

- `20260928173000_academy_2_certificates_cohorts.sql`
- `20260928173000_public_digital_literacy.sql`

O conteúdo de Letramento Digital já foi republicado em `20260928174000_public_digital_literacy.sql`, que declara explicitamente a renumeração. Portanto, os arquivos históricos não devem ser renomeados, removidos ou reescritos sem confirmar primeiro o histórico real de migrations do projeto Supabase remoto.

### Regra daqui em diante

Novas migrations devem possuir prefixo temporal único. O teste de integridade permite somente a colisão histórica acima e falha se uma nova colisão aparecer.

### Produção

Como o repositório não prova sozinho quais versões foram registradas no Supabase remoto, esta correção é deliberadamente não destrutiva: não altera schema nem tenta reconciliar a tabela de histórico remotamente. A migration `20260928174000_public_digital_literacy.sql` é a versão canônica do seed público para novos ambientes.
