# SAGAMENTE — PACOTE ÚNICO DE MIGRAÇÃO WHATSAPP SEM CMD
Data: 2026-10-11
Branch: spike/cloudflare-free-whatsapp-feasibility-20261011
PR: #376 (DRAFT / NÃO MESCLAR)

## Resultado contratado
Uma Central WhatsApp na Sagamente onde administrador autorizado conecta por QR (ou código de pareamento), consulta status, ativa envios apenas de destinatários com opt-in comprovado e mantém sessões/eventos/filas com o PC desligado. Limite financeiro obrigatório: R$0, sem cartão, depósito ou custo automático. Nenhum bloqueio é ocultado por status "verde" genérico.

## Estado atual, validado
- PASSOU: Workers Free + Durable Objects SQLite, operação de storage cifrado AES-GCM com segredo Cloudflare, persistência entre requests no probe.
- PASSOU: Baileys bundling/import, geração de credenciais e leitura cifrada no DO LOCAL de teste.
- PASSOU: WebSocket INBOUND local (WebSocketPair) e testes de timeout/simulação.
- BLOQUEADO: WebSocket OUTBOUND do runtime local para echo.websocket.events: falhou, cf. Actions #38152178993 (internal error reference). NÃO comprova impossibilidade da Cloudflare remota nem WhatsApp.
- NÃO FEITO: conexão Baileys real Cloudflare, sessão autenticação sinal/SignalKeyStore completo, QR protegido, reconexão, limite real de cotas, envio de ponta a ponta com PC off.
- RISCO: outbound WS pode manter o DO em memória por no máximo 15 minutos por conexão. Não garantir 24/7 no Free antes de teste operacional.
- NÃO APTO PRODUÇÃO: compat/src/index.js guarda chave junto ao ciphertext SOMENTE em teste local.

## Execução concentrada — não liberar passo a passo ao usuário
### Bloco A — Fundamentos e diagnóstico (uma só rodada CI)
A1. Reproduzir WebSocket OUTBOUND em Cloudflare REMOTA, worker separado; medir HTTP status, handshake, close e duração.
A2. Criar echo controlado em Worker separado ou usar endpoint WS reconhecido. Não atribuir falhas de terceiro ao Baileys.
A3. Fixar versão das dependências + npm lock e validar orçamento Worker/DO em dashboard; falha real deve reprovar o CI, não apenas logar.
CRITÉRIO: handshake + ping/pong + close, demonstrados fora do wrangler local. Se falhar, STOP e parecer.

### Bloco B — Adaptador real de credenciais (isolado)
B1. Implementar get/set de SignalKeyStore, creds.update, BufferJSON para tipos binários e transaction/multi-key; serializar write atomically.
B2. AES-GCM com IV aleatório por escrita e AAD por tipo/id/versão; chave apenas Cloudflare secret. Nunca retornar payload a endpoint web.
B3. Reconexão/redeploy/evicção: simular várias inicializações e rotações de chave, com replays/revisões e tratamento de corrupção; test infração RLS.
B4. Endpoints fechados por autenticação de administrador + proteção anti-CSRF/rate limit; nenhum caminho GET muta sessão.
CRITÉRIO: teste de produção de forma adversarial + nenhuma chave no GitHub/logs/JSON; se falhar, STOP.

### Bloco C — Socket Baileys em ambiente descartável
C1. DO dedicado com único escritor e limite explícito de 60s para first-contact/QR; timer/alarm para cleanup.
C2. Desativar handlers de envio, claim da fila e qualquer acesso Supabase production; somente eventos e status em log saneado.
C3. Testar handshake WebSocket do Baileys, erros desconexão, status QR e cleanup; sem usar o número comercial antes de autorização de cutover.
C4. Avaliar se termos, riscos de biblioteca não oficial e uso recorrente são aceitáveis.
CRITÉRIO: socket inicializa sem travar Worker, QR obtido protegido, encerra sem vazamento.

### Bloco D — Medição Free / decisão GO-NO GO
D1. Teste controlado 15+ min, suspensão, reconexão e redeploy; documentar perdas de sessão/mensagens.
D2. Validar duração GB-s dia, requests e storage em conta Free. Confirmação expressa de nenhum auto-upgrade.
D3. Simular máquina local desligada e servidor remoto sem cron auxiliar pago.
CRITÉRIO: 24h de teste demonstrando estabilidade razoável e margem de recursos Free. Se não possível, NO-GO Cloudflare para o resultado exigido: sugerir alternativa sem cartão ou explicar inviabilidade sem inventar garantia.

### Bloco E — Integração Central e migração final
E1. Página admin de QR/status/consentimento, logs saneados, reconectar/desconectar, health-check.
E2. Uma ponte ativa por vez, desabilitar bridge Windows apenas em cutover planejado, manter rollback imediato.
E3. Reutilizar Supabase wa_bridge_claim/finish e monitorar idempotência, destinatários consentidos, anexo link Drive.
E4. Teste E2E em dispositivo real com consentimento do destinatário, notificações, ack, 24h de observação e rollback.
CRITÉRIO: PC off + entrega confirmada no WhatsApp + custos sem cobrança + painel funcionando.

## Política de release / riscos
- Proibido mesclar PR #376 na main automaticamente.
- Nenhum segredo ou sessão real será enviado como arquivo para o GitHub.
- Não desconectar CMD ou vincular número comercial até blocos A-D passarem e E ter rollback preparado.
- Cada bloco registra evidência (link run/resultado específico) e responsável pela decisão. Etapas A-E são executadas como pacote, com relatório final; STOP antecipado em impedimento técnico ou financeiro.
- Não pedir ao usuário uma sequência de testes manuais de JSON sintético. Solicitar uma única intervenção somente se pareamento real se tornar necessário e seguro.

## Checkpoint 2026-10-11
Bloco A: em andamento — falha externa demonstrada em CI, precisa diferenciar ambiente local vs edge remoto.
Bloco B: parcial — há testes locais mas não adaptador transacional de chave segura.
Blocos C-E: pendentes.
GO-LIVE: NÃO.
Referências: https://developers.cloudflare.com/durable-objects/platform/pricing/ ; https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/
