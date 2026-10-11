# Sagamente — diagnóstico da ponte WhatsApp no Cloudflare Free

## Estado: prova isolada; **não é migração do Baileys**
O site `playsistem-oficial` e a ponte Windows permanecem inalterados.
O Worker de prova é separado, não possui secrets e não consome a fila de mensagens.

### Fatos da arquitetura existente
- `services/whatsapp-bridge/index.mjs` usa `useMultiFileAuthState` com `fs` e `.local/session`.
- Mantém um socket WhatsApp Web/Baileys aberto em um laço `while(!stopping)` com intervalos de 4 segundos.
- Requer `SUPABASE_SERVICE_ROLE_KEY` e faz `wa_bridge_claim` somente quando autorizado.
- Worker Free e Durable Objects SQLite não executam diretamente essa aplicação Node/Linux.
- Durable Objects podem manter conexões WebSocket de saída ativas, mas isso não demonstra compatibilidade do protocolo, biblioteca Baileys nem do armazenamento criptografado de sessão.

### Critérios de aceitação antes de mover a ponte real
1. Provar suporte e estabilidade dos módulos Node usados pelo Baileys em ambiente Workers; não colocar credenciais reais no teste.
2. Substituir sessão multi-arquivos por credenciais criptografadas em armazenamento compatível (com rotação/recuperação e controle de acesso).
3. Reconexão, autenticação QR, heartbeat, deduplicação e envio por 72h com limites de Free observados.
4. Verificar sem cobrança o plano e as cotas da conta; parada segura quando atingir limites.
5. Homologar envio e confirmação com um único número autorizado; somente depois fazer cutover.
6. Nunca iniciar ponte de produção em duas instâncias simultâneas e nunca reaproveitar credenciais entre ambientes.

### Probe
`wrangler -c experiments/cloudflare-wa-free/wrangler.jsonc deploy` (somente depois de confirmar cotas da conta).
Acesso: `GET /probe` responde status do objeto e demonstra persistência básica de estado, mas não envia WhatsApp.
Sem credenciais, sem integração com Supabase e sem mudança no domínio da Sagamente.

### Resultado esperado desta etapa
Diferenciar a existência de Workers/Durable Objects gratuitos de uma implementação WhatsApp comprovada.
**Não comunicar ao usuário que o WhatsApp independente de PC foi implantado a partir deste probe.**
