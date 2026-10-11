# Meta WhatsApp webhook — preparação isolada da Sagamente

**Escopo:** somente desafio de verificação GET da Meta e confirmação segura de eventos POST assinados; não envia mensagens, não altera WhatsApp Business, não escreve no banco, não lê nem remove o CMD.

Endpoint da função (após deploy confirmado):
`https://lfmjqctiutajgtacvxfq.supabase.co/functions/v1/meta-whatsapp-webhook`

## Segurança, configuração mínima

É um webhook EXTERNO à plataforma. Por isso o endpoint precisa de `verify_jwt = false` (a Meta não apresenta token Supabase), **mas a validação é realizada pelo próprio código**:
- GET: exige token `META_WA_VERIFY_TOKEN` de pelo menos 24 caracteres e devolve somente o `hub.challenge` correto.
- POST: exige `META_WA_APP_SECRET` de pelo menos 16 caracteres, assinatura Meta `X-Hub-Signature-256` válida (HMAC-SHA256 sobre corpo bruto), JSON válido e evento `whatsapp_business_account`.
- Secrets ausentes retornam HTTP 503. Não copie tokens no código, frontend, prints, repositório ou chat.
- POST válido recebe HTTP 200 com `processed:false`. **NÃO é confirmação de entrega** nem auditoria persistida.
- O piloto não faz envio de mensagens e não altera a fila.

## Setup manual restrito

1. Supabase da Sagamente → Edge Functions → Secrets: adicionar `META_WA_VERIFY_TOKEN` (gerar valor aleatório longo, 32 bytes, armazenar com segurança) e `META_WA_APP_SECRET` (segredo do aplicativo Meta for Developers → Configurações do app → Básico; **não** é o token de acesso do Graph API).
2. Meta for Developers → app Sagamente → WhatsApp → Etapa 2 → Configurar webhooks:
   - URL de callback: endereço HTTPS acima **somente depois de deploy confirmado**.
   - Verificar token: exatamente o mesmo valor salvo em `META_WA_VERIFY_TOKEN`.
   - Clique Verificar e salvar.
3. Assinar o campo `messages` nos webhooks do objeto WhatsApp Business Account quando a Meta oferecer essa opção. A assinatura usa o *App Secret* configurado no Supabase.
4. Verificar recebimento de POST assinado em ambiente controlado sem armazenar PII. O código atual devolve `processed:false`, sem conferir entrega.
5. **Não registrar número comercial, adicionar método de pagamento nem ativar envios**. Essa etapa exige avaliação financeira e de coexistência posterior.

## Critérios antes de evoluir

- Nome/número de teste da Meta continuam separados do telefone comercial no WhatsApp Business App.
- Integrar tabelas de status e idempotência apenas depois da confirmação de segurança. Nunca considerar aceitação HTTP como entrega.
- Tratar mensagem com `status: failed` antes de assumir sucesso; custos de mensagens proativas podem existir.
- Nenhum dado sensível é escrito em logs nesse endpoint.

Referências: https://supabase.com/docs/guides/functions/auth ; https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
