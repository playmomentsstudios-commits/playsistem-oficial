# SAGAMENTE — decisão de canais e implantação 24/7 (auditoria de 11/10/2026)

**Objetivo operacional:** notificações automáticas com o computador desligado; nunca assumir R$ 0, nunca migrar o número comercial sem validação e aprovação explícita de custos.

## 1. Estado auditado no código (branch main, 11/10/2026)

| Camada | Evidência | Consequência |
|---|---|---|
| Gerador de notificações | `public.whatsapp_message_outbox`; regras de projeto, tarefa, etapa, arquivos e alertas em `src/pages/admin/AdminWhatsappCenter.tsx` e migrations `20261010230000_whatsapp_admin_audit_center.sql` | Um aviso pode surgir sem mensagem anterior do cliente; não assumir janela de atendimento |
| Ponte atual | `services/whatsapp-bridge/index.mjs`, RPC `wa_bridge_claim`, `wa_bridge_finish`, `wa_bridge_worker_report` | Dependência Windows/Node local; Baileys não oficial; preservar até corte validado |
| Consentimento | `src/lib/whatsappConsent.ts`, preferências `wa_automatic_opt_in`, telefone vinculado e timestamp | Reutilizar aceite; nenhuma migração autoriza destinatários sem consentimento válido |
| Painel | `src/pages/admin/AdminWhatsappCenter.tsx`, `src/components/admin/WhatsappQrBridgePanel.tsx` | Separar visual de provedor; aplicar layout minimalista depois do contrato de estado |
| Canal já implementado | `src/api/pushNotifications.ts` e `supabase/functions/push-control`, `push-dispatch` | PWA/Web Push é caminho potencial para notificações sem WhatsApp e sem exigir computador ligado; falta teste real em produção |
| Piloto Cloudflare | PR #376 e auditoria PR #384 | Baileys na Cloudflare: **NO-GO**; Worker experimental colocado em quarentena, QR não demonstrado |

**Importante:** auditoria de código, não prova de funcionamento em produção. Nenhuma mensagem externa foi enviada nem o número foi registrado em outra plataforma.

## 2. Pesquisa oficial — WhatsApp Business Platform

- Política de preço vigente: **cobrança por mensagem entregue** conforme mercado e categoria; mensagens de **serviço** e mensagens de **utilidade em resposta ao cliente** são gratuitas nas condições especificadas. Janela de atendimento de 24 h abre após mensagem recebida do cliente.
- **Avisos proativos:** fora da janela de 24 h, normalmente exigem **modelo (template) aprovado**, e podem gerar cobrança por mensagem entregue. Não chamar todos os eventos internos de `utility` automaticamente: a categoria depende da política/revisão Meta.
- Mercado Brasil possui tarifa específica, que pode mudar. **Não fixar taxa em código ou prometer um número** sem consulta à tabela oficial no momento da aprovação.
- Consulta oficial: https://business.whatsapp.com/products/platform-pricing
- Política de negócios/consentimento: https://business.whatsapp.com/policy/preview?lang=pt_BR
- Coexistência com aplicativo WhatsApp Business pode estar disponível conforme elegibilidade/número/conta/provedor. **Não presumir** que o número atual tenha o app Business ou que seja elegível. Se o número for WhatsApp pessoal, não tratá-lo como número Business elegível automaticamente. Onboarding/registro do número exige consentimento expresso; pode afetar sessões e aparelhos vinculados.

## 3. GO / NO-GO por requisito

| Exigência | Baileys + DO Cloudflare Free | Cloud API oficial da Meta | Web Push Sagamente |
|---|---|---|---|
| Envio WhatsApp sem CMD | NÃO demonstrado; risco de suspensão/eviction | Potencialmente SIM, via HTTP/webhooks | NÃO é WhatsApp |
| Uso com telefone atual | Experimental, risco de bloqueio | Depende de elegibilidade e modalidade de onboarding/coexistência | Independente do número |
| R$ 0 garantido para **qualquer notificação proativa** | NÃO comprovado | **NÃO**; templates e mensagens podem ser cobrados | Não cobra tarifas Meta por mensagem; infraestrutura existente e limites precisam ser validados |
| Entrega comprovada | Não | Webhooks de status oficiais após implementação | Confirmação push/navegador distinta de leitura real |
| Conformidade | Biblioteca não oficial | Plataforma oficial + templates + opt-in | Permissão explícita por dispositivo |

**Decisão:**
- **GO para estudo e implementação isolada do adaptador HTTP Cloud API oficial**, sem cadastrar número, habilitar produção ou enviar mensagens.
- **GO para auditoria/validação do Web Push PWA já implementado** como canal de contingência; custo final de infraestrutura deve ser verificado.
- **NO-GO para migrar número comercial ou habilitar envio automático Cloud API** sem rate card Brasil, elegibilidade, modelos e orçamento aprovado.
- **NO-GO para novos testes de QR Baileys/DO** enquanto não houver arquitetura nova que resolva estabilidade e segurança.

## 4. Arquitetura-alvo reutilizando a Sagamente

`notifications` → `whatsapp_message_outbox` → **roteador de provedores com fail-closed** → (`meta_cloud_api` **ou** `local_baileys`, jamais ambos para o mesmo aviso) → tentativas/status/auditoria.

### Implementação futura: pacotes, nesta ordem
1. **Pré-voo somente leitura:** saber se o número atual é WhatsApp Business App ou pessoal; confirmar Meta Business Portfolio/WABA existente e disponibilidade de Coexistence; apurar volume de mensagens proativas por mês e categorias; listar regras de consentimento, deduplicação, limites e destinatários. NÃO registrar número, não solicitar pagamento.
2. **Piloto com número de teste da Meta:** backend de mensagens e webhook separado (`GET` desafio e validação de assinatura `X-Hub-Signature-256` em `POST`), credenciais apenas em secrets de servidor, idempotência por notificação, logging sem conteúdo sensível; envio apenas para destinatário de teste autorizado e com aprovação explícita.
3. **Controle financeiro obrigatório (padrão fechado):** `provider=disabled`, `monthly_budget_brl=0`, `send_approved=false`; nenhum envio proativo pago sem orçamento e confirmação. Estimar custo por país/categoria/template a cada migração; bloquear automático quando preço for desconhecido, orçamento insuficiente, opt-in inválido, janela desconhecida ou número errado.
4. **Corte de produção apenas após validação:** template aprovado, permissão e onboarding com o número correto, recebimento de webhooks reais, entrega confirmada, tentativas/deduplicação e reversão da rota; desligar ponte Windows somente depois de confirmação ponto a ponto.

### Requisitos de UX — minimalismo já solicitado
Na **Central WhatsApp**, apresentar apenas **status, número, canal de envio, ação primária e indicadores Pendentes/Enviadas/Falhas**. Consentimento, logs, limites e categoria/custo vão em ajustes/detalhes; controles de segurança nunca devem ser removidos só porque foram ocultados.

## 5. Próxima decisão do proprietário (sem mexer em produção)

**Uma única pergunta material:** o número comercial usado na Sagamente está registrado no **WhatsApp Business** ou no **WhatsApp comum**? Isso determina a viabilidade de coexistência e o procedimento de integração. Confirmar sem compartilhar token, chave ou QR.

Até obter essa informação e validar custos, **manter CMD, sessão atual, opt-in e fila como estão**.

## Fontes e ressalvas

- Meta/WhatsApp Business Platform Pricing: https://business.whatsapp.com/products/platform-pricing — cobrança e exceções podem mudar.
- Meta WhatsApp Business Messaging Policy: https://business.whatsapp.com/policy/preview?lang=pt_BR — exigência de modelo e consentimento.
- Cloudflare Durable Objects lifecycle: https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/ — outbound WebSocket não garante processo imortal.
- Cloudflare DO pricing/free: https://developers.cloudflare.com/durable-objects/platform/pricing/ — cotas não significam disponibilidade 24/7.
- Auditoria interna experimental: `experiments/cloudflare-wa-free/AUDITORIA-GO-NO-GO-2026-10-11.md` (PR #384).
