# Sagamente WhatsApp — início automático no Windows

**Objetivo:** ao entrar na conta Windows, iniciar a mesma ponte Node/Baileys sem precisar abrir CMD. Não troca Cloudflare, Supabase, canal, número, QR ou fila. **O computador ainda precisa estar ligado, sem suspensão, com internet e usuário conectado.**

## Preparação (uma vez, sem credenciais novas)

1. Mantenha **a mesma pasta** que já funciona; jamais apague `.env` ou `.local/session`.
2. Verifique que a ponte já consegue conectar com o `Iniciar WhatsApp Sagamente.cmd`, que a sessão existe e Node 22+ está instalado.
3. Feche a ponte atual com Ctrl+C antes de registrar/iniciar a tarefa para evitar processos duplicados.
4. Abra PowerShell **normal, sem administrador**, e execute na pasta `services/whatsapp-bridge`:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\instalar-inicio-automatico.ps1"`
5. A tarefa `Sagamente WhatsApp Bridge` passa a iniciar automaticamente **ao fazer login na mesma conta Windows**.
6. Para rodar imediatamente sem reiniciar, no PowerShell:
   `Start-ScheduledTask -TaskName "Sagamente WhatsApp Bridge"`
7. Em **Sagamente → Comunicação → Central WhatsApp**, mantenha o modo `connect` solicitado e confirme o estado **Conectado** e atualização do heartbeat. O agendador marcar `Running` não prova conexão WhatsApp.
8. Teste reiniciar/logar novamente, verifique conexão, número autorizado, e somente depois considere um envio de teste consentido na Central. Não ativar envios para todos.

## Gerenciar

- **Iniciar:** `Start-ScheduledTask -TaskName "Sagamente WhatsApp Bridge"`
- **Parar:** `Stop-ScheduledTask -TaskName "Sagamente WhatsApp Bridge"`
- **Consultar:** `Get-ScheduledTask -TaskName "Sagamente WhatsApp Bridge" | Get-ScheduledTaskInfo`
- **Remover autostart:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\desinstalar-inicio-automatico.ps1"`
- **Visual:** abra o Agendador de Tarefas do Windows e localize `Sagamente WhatsApp Bridge`.
- **Para fixar atalho:** crie um atalho para `taskschd.msc` ou para PowerShell com o comando de inicialização; fixar é opcional e não altera a execução.

## Cuidados

- A tarefa usa o contexto do **usuário atual, com sessão iniciada**, sem pedir senha ou privilégio de administrador. Não funciona antes do login e não impede o Windows de suspender.
- **Não** execute manualmente CMD ao mesmo tempo. O runner verifica processos Node existentes e bloqueia uma segunda tarefa por mutex; o isolamento do lado da fila permanece uma defesa adicional.
- Não execute o instalador de configuração que pede a service_role automaticamente; o script novo **não solicita nem exibe** a chave.
- **Não** mova ou renomeie a pasta após instalar; em caso de mudança execute o instalador novamente, após remover a tarefa anterior.
- Se o Windows informar erro de tarefa, confirme as permissões da conta/Política do Agendador de Tarefas. Não desative antivírus nem segurança do Windows.
- Uma sessão Baileys pode expirar e exigir novo QR, mesmo que os arquivos estejam preservados.
- O Baileys não é uma API oficial; há risco de limitação/bloqueio do número, e ausência de tarifa Meta por mensagem não significa ausência de custo de energia/internet.
