# Home e atendimento

A Home preserva o tema dark, a marca e as áreas existentes; destaca contato, orçamento,
produtos, serviços e dúvidas. Login e cadastro preservam `next`, validam destinos
internos e encaminham admin/staff para o atendimento administrativo.

## Ativação em produção

1. Aplicar as migrações existentes de profiles e catálogo e depois
   `supabase/migrations/20260925040000_create_conversations.sql` no projeto Supabase.
2. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no frontend.
3. Em Authentication / URL Configuration, autorizar a origem de produção com o
   caminho `/login` e seus parâmetros de retorno. O cadastro envia `emailRedirectTo`
   com o destino validado para preservar orçamento/dúvida após confirmação de e-mail.
4. Publicar o frontend e testar com duas contas customer e uma conta staff/admin.
   Criar contas pelo cadastro real; funções administrativas são atribuídas por um
   operador autorizado no banco, nunca pelo formulário público.

## Chat

As telas de cliente e equipe usam a mesma API Supabase, com tabelas `conversations`
e `messages`. As rotas antigas de chat em KV foram retiradas da Edge Function para
não manter duas caixas de entrada. Outros módulos legados não foram migrados.
Se existirem conversas reais no KV de uma implantação anterior, exportar e migrar
esses dados antes de publicar; esta migração não importa dados KV automaticamente.

Cada cliente ativo tem uma conversa persistente. A abertura é idempotente, inclusive
em abas concorrentes. As políticas RLS isolam clientes e permitem atendimento por
staff/admin ativos. Mensagens são somente de texto, até 5.000 caracteres. A interface
consulta mensagens a cada 5 segundos e a lista administrativa a cada 10 segundos;
exibe as 200 mensagens mais recentes ao abrir a conversa. Não simula presença online,
leitura ou respostas. Falhas mantêm o texto; o identificador é reutilizado ao repetir
um envio sem alterações, evitando duplicação após perda de resposta.

## Validação

- `pnpm test`: destinos de retorno e políticas SQL executadas em PostgreSQL/PGlite.
- `pnpm typecheck`: TypeScript.
- `pnpm build`: compilação de produção.
- Validação no navegador: Home desktop/mobile, links cadastro/login, destinos por
  papel, falha/reenvio/reabertura do chat e menu autenticado mobile. A validação de
  interface usa uma API de teste interceptada; não comprova configuração da produção.

Roteiro após publicação: abrir orçamento como visitante, cadastrar e confirmar o
 e-mail, enviar mensagem, responder como staff, recarregar como cliente e verificar
persistência. Com outro cliente, confirmar que a primeira conversa não é acessível.
