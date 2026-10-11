# SAGAMENTE — Migração correta da ponte WhatsApp, sem API paga da Meta

## Decisão e status

**Escopo:** mover SOMENTE o processo de execução de `services/whatsapp-bridge/index.mjs` para um **host Linux com Node 22 / Docker**, mantendo a aplicação Sagamente no Cloudflare, fila e autorização no Supabase e o WhatsApp Business já usado.

**Implementado neste PR:** imagem Node não-root, Compose com reinicialização, sessão persistente em volume privado, sem porta HTTP pública, filesystem raiz read-only, validação CI e plano de corte.

**Não implementado / NÃO prometer:** servidor remoto contratado/provisionado, custo zero garantido, disponibilidade 24/7, pareamento real em servidor, QR remoto, entrega real após corte. O contêiner por si só NÃO é uma hospedagem.

**Meta Cloud API não integra este fluxo:** nenhum token da Meta, template pago, número de teste da Meta ou webhook oficial é necessário para esta migração. A Edge Function `meta-whatsapp-webhook` existente é projeto separado e **não deve ser usada na migração da ponte Baileys**.

## Por que não somente Cloudflare Workers Free

O Worker Cloudflare mantém a **página web**, autenticação visual e possíveis endpoints de controle. Ele não garante um processo Node/Baileys 24/7 na forma exigida. O experimento de Durable Objects (PR #376) não gerou QR comprovado e apresentou inconsistência de início/rollback (auditoria `experiments/cloudflare-wa-free/AUDITORIA-GO-NO-GO-2026-10-11.md`); permanece isolado e desativado. **Cloudflare Tunnel não resolve**: o `cloudflared` precisa executar no computador/origem e fica offline quando ele desliga.

| Ambiente | Sem CMD | PC desligado | R$ 0 garantido | Decisão |
|---|---:|---:|---:|---|
| Windows com ponte atual | Não | Não | Sem tarifa Meta, mas usa energia/internet | Manter até homologação |
| Windows com Serviço/Agendador | Sim | Não | Sem tarifa Meta, mas usa energia/internet | Alternativa se aceitar PC ligado |
| Cloudflare Workers Free / DO | Sim | Potencial | Não demonstrado | **NO-GO para o número real** |
| Host Linux persistente com Docker | Sim | Sim | **Depende da oferta do provedor; não presumir** | **GO técnico condicionado** |
| Meta Cloud API | Sim | Sim | Não para todas as notificações | Fora do escopo |

## Instalação em servidor Linux já disponível e autorizado

**Pré-condições:** servidor ligado continuamente com Docker + Compose, rede de saída, armazenamento persistente e custo aprovado. Nunca cadastrar cartão, selecionar plano pago ou provisionar recursos sem autorização explícita.

1. Mantenha a ponte Windows operando, mas em **Pausar envios** na Central antes do ensaio remoto.
2. No servidor, obter uma cópia PRIVADA do repositório (ou somente a pasta `services/whatsapp-bridge`). Arquivos `.env`, `.local/session` e quaisquer credenciais ficam FORA do GitHub, backups públicos e imagens Docker.
3. Dentro de `services/whatsapp-bridge`, preparar `.env` privado baseado em `.env.example`, com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SAGAMENTE_WHATSAPP_PHONE`, validando que este número corresponde ao configurado na Central. **Não copiar/mostrar as chaves no chat.** Permissão Unix `chmod 600 .env`.
4. Verificar que a ponte Windows **não está competindo pela mesma instância**. Em procedimento de corte controlado, parar sua execução sem revogar a sessão (`Ctrl+C`/parar serviço). NÃO apagar o `.local/session` do Windows.
5. Executar `docker compose up -d --build` no diretório da ponte.
6. Em Sagamente → Comunicação → Central WhatsApp, pedir conexão se necessário e ler o QR no WhatsApp Business → Dispositivos conectados. **Parear somente número de teste/conta explicitamente aprovada; comparar conta e número no painel.**
7. Verificar conexão, heartbeat, número/JID, entregar UMA notificação de teste consentida e conferir comprovante real de entrega no destino antes de ativar clientes. A aceitação do `sendMessage` por si só não comprova entrega.
8. Depois de estabilidade e auditoria, autorizar `wa_bridge_auto_enabled` gradualmente. Se falhar, pausar, parar contêiner, restaurar a execução Windows e verificar que só UMA instância reivindica a fila.

### Operação e diagnóstico

- `docker compose ps` — contêiner executando, **não prova WhatsApp conectado**.
- `docker compose logs --tail 80 bridge` — não divulgar prints de QR/segredos/números.
- `docker compose restart bridge` — reiniciar sem limpar a sessão.
- `docker compose stop bridge` — interromper com segurança.
- `docker compose down` — remove contêiner/rede, **preserva volume** (desde que NÃO use `-v`).
- Backup da sessão: volume Docker privado `sagamente-whatsapp_session`; backups criptografados sob controle do proprietário. Perda do volume exigirá novo QR.
- `docker compose ps` e `restart: unless-stopped` não garantem disponibilidade: o host e a conexão internet precisam funcionar.
- A biblioteca Baileys é não oficial e existe risco de suspensão/banimento do WhatsApp. Proibidos envios em massa, destinatários não consentidos e duplicação de instâncias.

## Critério estrito do objetivo original

**SÓ marcar migração como concluída quando:**
- Host independente do PC realmente disponível, com orçamento **R$ 0 comprovado ou aprovado explicitamente**;
- Um processo Node/Baileys remoto gera QR no painel, conecta o número autorizado e reconecta após reinício sem perder sessão;
- o CMD permanece desligado, nenhuma duplicidade; envio e recibo confirmados;
- serviço continua funcionando com PC desligado e durante teste de 24 h, dentro das cotas acordadas.

Se a única oferta exigir cartão, pagamento, suspender por inatividade ou tiver limite de duração incompatível, **NO-GO no requisito gratuito permanente**. Não alterar o painel para fingir que a migração aconteceu.
