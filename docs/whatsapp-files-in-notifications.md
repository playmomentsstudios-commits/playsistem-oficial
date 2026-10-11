# Arquivo direto no WhatsApp — Sagamente

As novas mensagens de tarefa ou etapa podem trazer um **arquivo do Google Drive vinculado àquele registro**, seguido do link compacto da tarefa/etapa na Sagamente.

Formato:
```
SAGAMENTE — Tarefa atualizada

A tarefa "Cartaz" agora está em revisão.

📎 Arquivo desta tarefa: cartaz-previa.png
https://<projeto-supabase>.supabase.co/functions/v1/whatsapp-file-open?t=<token-temporario>

Ver tarefa e detalhes:
https://playsistem-oficial.playmomentsstudios.workers.dev/n/<codigo>
```

O link de arquivo abre os bytes no navegador do destinatário **sem login no portal**; o segundo link abre a tarefa no portal e respeita o login do cliente. O link de arquivo vence **48 horas depois da notificação**, não é permanente, e pode ser encaminhado enquanto válido. O arquivo do Drive **não é transformado em público**.

As regras verificam cliente ativo/vinculado ao projeto, projeto externo, tarefa/etapa visível e arquivo com `client_visible=true`. A cada abertura o servidor verifica novamente o vínculo e as visibilidades. Se o arquivo não existe ou é privado, o WhatsApp recebe **somente o link da tarefa**. Só é incluído o arquivo mais recentemente cadastrado diretamente na tarefa ou etapa (um arquivo por aviso); arquivos de tarefas ocultas não entram na mensagem da etapa.

A extensão não altera eventos antigos e não reenvia mensagens. O limite diário, consentimento do WhatsApp, histórico e pausa continuam como antes. O endpoint tem autenticação por token de uso temporário e `verify_jwt=false` **somente** porque valida token aleatório de 64 dígitos, SHA-256 no banco, expiração e autorização por arquivo. A função possui service role no servidor, nunca no cliente.

Testes: simular notificações dentro de transação `BEGIN ... ROLLBACK`, sem permitir que a ponte as envie. Testar no WhatsApp de um cliente consentido apenas quando ele estiver autorizado e o serviço local atualizado estiver conectado.
