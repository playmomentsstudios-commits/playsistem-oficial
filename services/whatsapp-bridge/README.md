# Sagamente · Ponte WhatsApp via QR (piloto local)

**Uso experimental com o número +55 64 98129-4186.** A biblioteca Baileys é **não oficial**. O WhatsApp pode restringir ou banir o número. Não há garantia de continuidade, entrega ou funcionamento permanente. Não substitui a API oficial.

## Arquitetura

- A aplicação web e o Cloudflare **não** executam o WhatsApp.
- O processo Node.js abaixo deve permanecer ligado em um computador próprio ou servidor dedicado. Sem ele, **nenhum QR real aparece e não há envio automático**.
- O painel solicita pareamento e mostra o QR através do Supabase. Somente usuários admin têm acesso.
- As credenciais da sessão ficam apenas na pasta local `.local/session`. Nunca no frontend ou GitHub.
- A service-role key fica somente no `.env` do processo Node. **Não utilizar `VITE_`**.
- A fila autoriza no máximo **10 tentativas por dia**, hora de Brasília. Tentativas incertas não são reenviadas para evitar duplicação.
- Modo padrão **teste somente**: mesmo quando o evento é de outro cliente, a mensagem sai apenas para o número de teste autorizado, com um cabeçalho de teste.
- Para uma futura liberação a clientes reais, há consentimento individual (`wa_automatic_opt_in`); nenhuma conta começa optada.
- `sent_auto` significa que a biblioteca retornou um ID de mensagem, **não** que o telefone recebeu ou leu.

## Instalação no Windows (Node 22)

1. Abra um terminal na cópia atualizada do repositório e entre em `services/whatsapp-bridge`.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha:
   - `SUPABASE_URL` do projeto Supabase da Sagamente.
   - `SUPABASE_SERVICE_ROLE_KEY` (chave **secreta** disponível no dashboard do Supabase; não compartilhe nem copie para o frontend).
   - `SAGAMENTE_WHATSAPP_PHONE=5564981294186`.
4. Execute `npm start` e deixe o terminal ligado.
5. No painel Sagamente entre em **Comunicação → Central WhatsApp → Conexão por QR** e escolha **Solicitar conexão**.
6. Quando o QR aparecer, no WhatsApp Business do celular: **Dispositivos conectados → Conectar um dispositivo** e leia o QR.
7. Confira que a central mostra o número correto e **Conectado**. Clique em **Ativar piloto**.
8. Faça uma **nova alteração real** de tarefa visível do projeto. A fila só aceita eventos novos depois da ativação.
9. Confira na central o status `Aceito pelo dispositivo (sem confirmação de entrega)`. Verifique o WhatsApp no número de teste.

Para parar, clique em **Pausar envios**; para revogar a sessão, clique em **Desconectar aparelho** (com o serviço Node online). Se desligar o processo, os envios param. Revogue também em **Dispositivos conectados** no próprio WhatsApp caso o computador seja perdido.

## Limitações

- Não faz envio retroativo, campanhas ou leitura de chats dos clientes.
- Não garante que uma mensagem foi entregue ou lida; validação real deve ser feita no celular.
- Computador em suspensão, sem internet ou serviço desligado = canal offline.
- Sem custo de licenciamento ou por mensagem pela biblioteca; energia, computador, internet e eventuais custos de hospedagem são externos.
- **É uma automação não oficial e pode violar os Termos de Serviço do WhatsApp.**
