# SAGAMENTE — Auditoria de encerramento da etapa de QR (11/10/2026)

## Escopo e evidências
- Repositório: `playmomentsstudios-commits/playsistem-oficial`
- Worker **isolado**, não comercial: `sagamente-wa-baileys-remote-probe`
- Diagnóstico de falha: GitHub Actions **#38160624283** (job `qr-only-diagnostic`).
- PR experimental: **#376**. O sistema comercial `playsistem-oficial` e o CMD/Node Windows **não foram migrados**.
- Baileys compilado e publicado; teste privado de credenciais criptografadas **#38157924302** passou. **Nenhum QR de conexão real foi confirmado.**

## Achados observados, não inferências
1. O job conferiu o commit experimental revisado `c0c72269720689809c4abf54effe1dbace429024`.
2. Um deploy temporário ativou `EXPERIMENTAL_PAIRING_ENABLED=true`, mas `POST /start` retornou HTTP 503, apesar de a etapa anterior de status ter informado ativação.
3. O rollback por Wrangler funcionou; a API Cloudflare confirmou `EXPERIMENTAL_PAIRING_ENABLED=false` e ausência de `EXPERIMENTAL_PAIRING_EXPIRES_AT`.
4. **Falha grave do próprio método de verificação:** o cleanup utilizava `POST /start` como *teste* do estado desativado. Este método **muda estado e pode iniciar um socket**, não é uma sondagem segura. Após o rollback ele retornou 200 e depois 409 por diversos ciclos, antes de retornar 503. Não atribuir isso automaticamente a violação externa; foi o próprio workflow com token válido.
5. Às 11/10/2026, após auditar, o subdomínio público do Worker experimental foi **desativado por API** (`enabled=false`, `previews_enabled=false`); pareamento `false`; expiração temporária ausente. Isso corta novas requisições pelo endereço workers.dev, mas **não é prova de encerramento de todo socket de saída já estabelecido**.
6. A ausência de QR deve ser classificada como **não conclusiva**: não há diagnóstico suficientemente preciso do handshake WhatsApp remoto para apontar a causa.

## Causa confirmada vs hipóteses
**Confirmada:** teste de rollback fazia mutação por `POST /start` e poderia ele próprio provocar respostas 200/409 e socket ativo. Isso é um defeito de design do teste e deve ser eliminado. A inconsistência entre configurações no Worker e no Durable Object também foi observada; o mecanismo interno (rollout, instância antiga, rebind, race, etc.) **não foi provado**.

## Decisão GO / NO-GO
- **NO-GO** para ativar QR ao cliente ou migrar a ponte comercial nesta arquitetura e estado atuais.
- **NO-GO** para afirmar 24/7 gratuito, autônomo e permanente: Cloudflare DO não oferece garantia de permanência de uma conexão WebSocket de saída. A conexão só evita eviction por até 15 minutos por operação antes de retornar à política do ciclo de vida.
- **Free quotas** também precisam ser respeitadas: DO Free inclui 13.000 GB-s/dia e 100.000 requests/dia. Nem viabilidade mensal nem margem para restante da plataforma foi demonstrada.
- Evidências da Cloudflare:
  - https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
  - https://developers.cloudflare.com/durable-objects/platform/pricing/

## Medidas concretas
- Worker experimental isolado foi retirado da internet pública: subdomínio workers.dev desligado; previews desligados.
- **Workflow de QR e deploy experimental pausados** no acionador até revisão de kill-switch/fail-closed; comandos antigos não devem ser executados.
- Todo healthcheck futuro deve ser **GET somente-leitura** (status/admin e conta Cloudflare); **NUNCA usar POST /start como verificação de rollback**.
- Não fazer novos deploys QR, não escanear QR e não conectar número comercial sem design revisado, teste de revogação e viabilidade econômica verificada.
- CMD comercial fica ativo.

## Recomendação operacional e próximo pacote
1. Se a exigência for 24/7 sem PC com **custo garantidamente zero**, não prometer compatibilidade Baileys/DO; avaliar **WhatsApp Business Platform (Cloud API oficial)**, custos por tipo de mensagem e elegibilidade gratuita antes de qualquer migração. Pode haver cobranças por mensagem-modelo: exigir aprovação de orçamento.
2. Se houver tolerância a custo fixo e o número permitir risco de biblioteca não oficial, estudar um runtime persistente/VPS com segurança, supervisão e reconexão; não apresentar como R$ 0 garantido.
3. Separar a UI minimalista da Central WhatsApp da decisão de runtime: estado, número, QR quando possível, entrega, avisos/erros e configurações recolhidas; manter opt-in, auditoria e controles de acesso.
4. Quando uma infraestrutura demonstrar QR, conexão, reconexão, entrega real e custos, executar **um único plano de corte** com rollback validado. Nunca desativar CMD antecipadamente.

**Estado final dessa auditoria:** Worker experimental em quarentena, QR não comprovado, operação comercial preservada. Não pedir repetição de testes antigos.
