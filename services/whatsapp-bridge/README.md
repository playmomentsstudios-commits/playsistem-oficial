# Sagamente · Ponte WhatsApp via QR (piloto local)

## Início rápido no Windows (sem comandos npm manuais)

1. Baixe e extraia a [versão atualizada do repositório](https://github.com/playmomentsstudios-commits/playsistem-oficial/archive/refs/heads/main.zip) numa pasta **privada** do computador.
2. Entre em `services/whatsapp-bridge` e dê dois cliques em **Iniciar WhatsApp Sagamente.cmd**.
3. O assistente verifica o Node.js 22+, instala as dependências se necessário e solicita **uma única vez** a chave `service_role`/secret do Supabase. A entrada é ocultada e o `.env` fica acessível apenas ao seu usuário Windows. **Não envie a chave neste chat, por WhatsApp ou em prints.**
4. Deixe a janela aberta. Na Sagamente: **Comunicação → Central WhatsApp → Solicitar conexão**.
5. Leia o QR no celular, verifique que a conta é **+55 64 98129-4186** e escolha **Ativar piloto**.
6. Clique em **Enviar teste para meu WhatsApp**, confira a mensagem no aplicativo e o resultado na Central.

**Limitação importante:** o assistente não instala Node.js automaticamente. Se não estiver instalado, ele informa como obter a versão 22 LTS. O computador precisa permanecer ligado. A `service_role` tem privilégios amplos; use somente em computador pessoal confiável e proteja a pasta da instalação. Não existe garantia de entrega ou de disponibilidade do número: a biblioteca é não oficial.



**Uso experimental com o número +55 64 98129-4186.** A biblioteca Baileys é **não oficial**. O WhatsApp pode restringir ou banir o número. Não há garantia de continuidade, entrega ou funcionamento permanente. Não substitui a API oficial.

## Correção de destinatários reais e confirmações (10/10/2026)

A versão anterior podia retornar ID de `sendMessage()` sem a mensagem aparecer no aparelho. Agora, para cada envio real, a ponte consulta `socket.onWhatsApp()`, valida que o JID devolvido corresponde ao número autorizado e só então tenta enviar. Na Central, **ID gerado não significa entrega**. Os eventos de servidor, entrega e leitura são contabilizados em separado quando observados.

**Atualização da ponte em um Windows já configurado:**

1. Em Comunicação → Central WhatsApp, clique **Pausar envios**. Feche a janela da ponte com **Ctrl+C**.
2. Baixe o ZIP atual do repositório e entre na pasta `services/whatsapp-bridge` do ZIP.
3. Copie **`index.mjs`**, **`phone-utils.mjs`** e o novo **`receipt-tracker.mjs`** para a pasta antiga da ponte no seu computador, confirmando a substituição dos dois primeiros.
4. **Não substitua nem compartilhe `.env` e não apague `.local/session`**. A chave e a sessão existentes permanecem no computador.
5. Execute novamente **Iniciar WhatsApp Sagamente.cmd** e mantenha a janela aberta.
6. Na Central, verifique **Conectado**. Não ative todos os clientes; selecione apenas um cliente com aceite.
7. Ative temporariamente e faça **uma nova alteração de status** de uma tarefa desse cliente. Confira `Número de envio real`, `Destino reconhecido` e `Confirmação do WhatsApp` na auditoria. Confirme também com o destinatário.

As tentativas antigas seguem classificadas como **sem confirmação**, não serão reenviadas automaticamente. Uma consulta sem confirmação de cadastro ou JID ambíguo será bloqueada; não há fallback cego para outros números. Desligue o piloto se o aparelho não mostrar a mensagem ou se aparecerem erros de consulta.

## Links originais do Google Drive nas notificações (11/10/2026)

Nas novas mensagens, cada arquivo liberado ao cliente aparece pelo **link original do Google Drive** salvo em `client_files.external_url`, não pelo visualizador da Sagamente. Quando o registro não possui URL original válida, a Sagamente constrói o endereço canônico do Drive a partir de seu identificador cadastrado.

Os nomes, o agrupamento da tarefa/etapa, o limite de arquivos apresentados, o texto e o link de acompanhamento permanecem como antes. Os links do Drive **não expiram por uma regra da Sagamente**, mas dependem do compartilhamento do Google: o cliente só consegue abrir/baixar se houver permissão no Drive. Nenhum arquivo é compartilhado ou tornado público automaticamente nesta mudança. Alterações de permissão no Drive também afetam links já enviados.

Não há mais anexos automáticos de JPG/PNG/PDF: cada atualização volta a ser **uma mensagem de texto com links**. Isso evita múltiplos envios por atualização. O processo Windows atualizado em `index.mjs` não chama a função de mídia. A ponte antiga que contém `media-attachments.mjs` não reconhece os novos URLs do Drive como anexos, de modo que as novas notificações funcionam sem reiniciar o computador; para remover também a capacidade de anexos de eventuais mensagens antigas na fila, substitua `index.mjs` pela versão atual e reinicie a ponte, preservando o `.env` e a sessão `.local/session`.

As mensagens já enviadas e seus links temporários antigos não são alterados ou reenviados.

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

## Solução de problemas no Windows

**Aparece `ERRO: npm.cmd nao encontrado`?** O Node.js pode estar instalado de forma incompleta, ou o `npm.cmd` não está no `PATH`. O iniciador agora verifica também a pasta do `node.exe` e o CLI local do npm antes de emitir o erro.

Se o problema continuar, instale/repare o [Node.js LTS para Windows](https://nodejs.org/en/download) com **npm package manager** e **Add to PATH** habilitados. Feche o terminal antigo, abra um PowerShell novo e confira:

```powershell
where.exe node
where.exe npm
node -v
npm -v
```

É necessário que **ambas** as versões apareçam. Depois, dê dois cliques em `Iniciar WhatsApp Sagamente.cmd` novamente. O programa não precisa de chave secreta para esse diagnóstico e ainda não envia mensagens.

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
