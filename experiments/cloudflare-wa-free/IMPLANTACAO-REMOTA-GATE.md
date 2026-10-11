# Liberação de implantação remota — bloqueio de credencial e disparo

**Estado verificado:** CI do PR #376 passou no commit b2cef80; artefato compilado existe. O worker remoto `sagamente-wa-baileys-remote-probe` NÃO foi implantado. O worker separado `sagamente-wa-cloudflare-probe` é outro serviço de testes (sem Baileys real).

## Execução exigida (sem produção)
1. Criar um Cloudflare API Token dedicado e restrito à conta, apenas Workers Scripts: Edit e leitura necessária de Workers; não usar Global API Key.
2. Disponibilizar `CLOUDFLARE_API_TOKEN` como secret do GitHub Actions, preferencialmente no environment protegido `whatsapp-experimental`, com aprovadores; garantir que `CLOUDFLARE_ACCOUNT_ID` permaneça o experimental conhecido.
3. GitHub pode exigir que `workflow_dispatch` exista na branch padrão. Não mesclar o PR experimental na `main` só para disparar a implantação. Em vez disso, um operador autorizado pode executar `npx wrangler deploy --config wrangler.remote.jsonc` **localmente na branch experimental**, usando um token temporário com escopo, ou preparar um workflow reutilizável no default em PR separado após aprovação.
4. Provisionar em Cloudflare **para o worker experimental** os secrets `PROBE_AES_KEY_B64` (32 bytes aleatórios, base64) e `PROBE_ACCESS_TOKEN` (token aleatório forte). Nunca registrar seus valores no código ou logs. Se ausentes, o Worker deve negar rotas privadas.
5. Em teste remoto inicial, manter `EXPERIMENTAL_PAIRING_ENABLED=false`. Validar `/health` e resposta 401 em `/start` e `/qr`. A conexão real NÃO pode iniciar até revisão de auth/session e aprovação de teste.
6. Depois validar com o ambiente configurado e autenticação, sem número comercial, sessão ou fila Supabase. Não substituir CMD.

## Importante
- GitHub Actions verde = compilação/testes locais, não implantação remota.
- A criação de workflow `workflow_dispatch` somente na branch spike não garante que o botão Run workflow apareça; isso é um bloqueio operacional e não justificativa para mesclar código não validado na main.
- Não foi confirmada a existência nem a configuração do secret GitHub `CLOUDFLARE_API_TOKEN`. Sem isso não afirmar deploy.


## Atualização efetiva 2026-10-11: infraestrutura de destino implantada

- Worker isolado `sagamente-wa-baileys-remote-probe` criado pela API Cloudflare, confirmado GET HTTP 200.
- Subdomínio workers.dev habilitado, confirmado GET HTTP 200 e `enabled:true`; `previews_enabled:false`.
- O script remoto é SOMENTE bootstrap de segurança/saúde; retorna `baileysLoaded:false`, `pairingEnabled:false`, `productionMessagesEnabled:false`.
- Rotas privadas `/start`, `/qr`, `/stop`, `/controller-status` devolvem 503 enquanto o Baileys não estiver implantado.
- **Não afirmar Baileys remoto validado, QR real ou credenciais remotas configuradas.** O bundle existe no artefato Actions #38153992392, mas o deploy desse bundle continua bloqueado pelo canal credenciado GitHub→Cloudflare.
- Próxima ação para operação: configurar token com escopo restrito no ambiente GitHub para rodar o workflow experimental ou realizar deploy restrito através de operador autenticado, então instalar secrets separados, validar segurança antes de habilitar login.
