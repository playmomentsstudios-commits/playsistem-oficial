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
staff/admin ativos. Mensagens aceitam texto de até 5.000 caracteres e um anexo por envio. A interface
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

## Arquivos originais e áudio

Aplicar também `supabase/migrations/20260925050000_chat_attachments.sql` no SQL Editor
ou pela rotina de migrações do projeto Supabase. Ela cria o bucket privado
`chat-attachments`, acrescenta metadados às mensagens e aplica políticas para que
somente o cliente da conversa e a equipe ativa possam acessar os anexos enviados.
A conta remetente pode acessar seu próprio upload ainda não enviado. Arquivos já
vinculados a mensagens não podem ser sobrescritos ou apagados pelo navegador.

A leitura usa `select('*')` para manter o chat de texto compatível com o esquema
anterior durante a ativação. O envio de anexos só funciona após a migração acima.
O limite global de Storage do projeto precisa permitir o limite do bucket: 50 MB.

- **Anexar arquivo:** arquivo original do aparelho, incluindo documentos e planilhas.
- **Fotos e vídeos:** seletor de mídia do navegador/celular, sem conversão ou redução
  feita pelo aplicativo. Formatos sem suporte de prévia, como HEIC/PSD, continuam
  disponíveis para download.
- **Gravar áudio:** pede o microfone somente ao clicar; permite parar, ouvir, remover
  ou enviar. Até 5 minutos por gravação. O microfone é liberado ao parar/cancelar ou
  sair da conversa. Precisa de HTTPS (ou localhost) e suporte a MediaRecorder.
- **Baixar original:** gera URL temporária de download com o nome original. Prévia
  de imagem, áudio e vídeo nativos; HTML/SVG e outros documentos não são executados
  dentro do chat. URLs assinadas expiram em 10 minutos; o botão renova a prévia.
- Um arquivo por mensagem, até 50 MB, com texto opcional. A confirmação só acontece
  após Storage e mensagem persistidos. Falhas mantêm o arquivo/texto para reenvio.

Uploads abandonados antes da mensagem podem ficar no bucket. O remetente pode
remover somente seus próprios objetos sem mensagem vinculada; uma futura rotina de
limpeza deve preservar todos os caminhos presentes em `messages.attachment_path`.

Validação local desta etapa: seis testes Node/SQL, TypeScript e build. Teste no
navegador com API interceptada e áudio sintético verifica arquivos originais,
metadados, reabertura, gravar/parar/ouvir/cancelar/enviar e layout mobile para os três
papéis. A migração não foi aplicada automaticamente ao projeto remoto.

Referências: [Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control)
e [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
