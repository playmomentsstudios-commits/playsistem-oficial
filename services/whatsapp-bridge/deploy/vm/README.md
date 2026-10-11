# Sagamente — retirar o CMD do computador sem trocar o WhatsApp

**Escopo: preparacao, nao producao.** Este pacote NAO cria servidor, nao registra telefone na Meta, nao inicia mensagens, nao altera Cloudflare nem desliga o Windows. A biblioteca Baileys e nao oficial: o WhatsApp pode restringir o numero.

## Arquitetura objetiva

A Sagamente e sua Central WhatsApp continuam no Cloudflare. A fila, o consentimento e a auditoria continuam no Supabase, usando as RPCs ja existentes: wa_bridge_claim, wa_bridge_finish e wa_bridge_worker_report. So o processo Node.js/Baileys sai do CMD Windows e passa a executar como um servico systemd em VM Linux. A ponte consulta o Supabase e o WhatsApp por conexoes **de saida**; nao precisa receber HTTP, de Cloudflare Tunnel ou de abrir portas para a aplicacao.

**Nao usar o piloto Baileys/Durable Objects existente.** A [auditoria Cloudflare de 11/10/2026](../../../../experiments/cloudflare-wa-free/AUDITORIA-GO-NO-GO-2026-10-11.md) registrou NO-GO, QR nao comprovado e Worker experimental em quarentena. A plataforma nao garante conexao WebSocket de saida 24/7 nesse modelo.

## VM possivelmente gratuita

A Oracle disponibiliza VMs marcadas **Always Free** (por exemplo, VM.Standard.E2.1.Micro e VM.Standard.A1.Flex), sujeitas a conta elegivel, cotas, estoque e regiao home. Cadastro pode requerer cartao; instancias ociosas podem ser recuperadas. Nao fazer upgrade para Pay As You Go. **Nao prometemos custo zero ou continuidade 24/7 antes de confirmar a conta e a VM.** A criacao da VM e uma acao do titular da conta e nao foi realizada neste PR.

Fonte oficial: https://docs.oracle.com/pt-br/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

Tambem serve qualquer servidor Ubuntu/Debian persistente ja contratado ou disponivel sem custo adicional. Hospedagens que dormem quando ociosas nao resolvem o problema.

## Preparacao tecnica, sem conectar WhatsApp

1. Em uma VM Ubuntu/Debian, confirmar no console do provedor que o tamanho, disco e rede estao nas cotas gratuitas ANTES de criar recursos. Restringir SSH por chave e IP; nao abrir portas para a ponte.
2. Instalar git, Node.js 22+ e npm pelos meios oficiais; conferir versoes com node -v e npm -v.
3. **Somente depois de revisar e integrar esta PR na branch main**, baixar o codigo e executar o instalador (ele instala somente arquivos/unidade; **NAO inicia ou habilita**):

       git clone --depth 1 https://github.com/playmomentsstudios-commits/playsistem-oficial.git
       cd playsistem-oficial
       sudo bash services/whatsapp-bridge/deploy/vm/install-service.sh

4. Criar o arquivo de credenciais privado e preencher com os valores ja existentes do Windows **sem compartilhar no chat, GitHub, screenshots ou CI**:

       sudo install -o sagamente-wa -g sagamente-wa -m 0600 /opt/sagamente-whatsapp-bridge/.env.example /opt/sagamente-whatsapp-bridge/.env
       sudoedit /opt/sagamente-whatsapp-bridge/.env
       sudo chown sagamente-wa:sagamente-wa /opt/sagamente-whatsapp-bridge/.env
       sudo chmod 600 /opt/sagamente-whatsapp-bridge/.env
       cd /opt/sagamente-whatsapp-bridge
       sudo -u sagamente-wa node preflight.mjs

   Configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SAGAMENTE_WHATSAPP_PHONE. A service_role tem privilegios amplos: nao colocar no frontend, em variaveis VITE_ ou em logs. O preflight so valida o arquivo **localmente**, nao acessa rede nem envia mensagens.

## Corte controlado somente quando a VM estiver pronta

5. Na Central WhatsApp, usar **Pausar envios**. Encerrar o CMD no Windows com Ctrl+C, sem selecionar Desconectar aparelho, e preservar a pasta .local/session do computador para rollback. Nao deixar duas pontes conectadas ao mesmo tempo.
6. Iniciar manualmente o servico Linux:

       sudo systemctl start sagamente-whatsapp-bridge
       sudo journalctl -u sagamente-whatsapp-bridge -n 80 --no-pager

   Solicitar conexao pelo painel e parear um QR novo apenas sob supervisao, verificando o numero autorizado. **Nao copiar sessao do Windows por meio inseguro.** Manter envios pausados ate concluir o pareamento.
7. Testar **uma** notificacao autorizada com destinatario sob controle e aceite valido. Verificar o recebimento real no telefone e o registro de auditoria. Somente depois, habilitar a inicializacao com o sistema:

       sudo systemctl enable sagamente-whatsapp-bridge

Se o QR nao funcionar ou a entrega nao for confirmada, **nao habilitar**. Interromper Linux e voltar ao CMD Windows. Nao reenviar automaticamente tentativas com entrega incerta.

## Status e rollback

    systemctl status sagamente-whatsapp-bridge --no-pager
    sudo journalctl -u sagamente-whatsapp-bridge -n 80 --no-pager
    sudo systemctl disable --now sagamente-whatsapp-bridge

Para rollback, reabrir a ponte Windows original, sem apagar sua configuracao. A conta pode exigir novo QR se uma nova sessao invalidar a antiga.

**Limites:** systemd recupera quedas do processo, mas nao evita banimento, falhas de QR, mudancas do WhatsApp, suspensao da VM gratuita ou interrupcoes de conectividade. 24/7 gratuito nao foi demonstrado. O sistema so estara realmente migrado apos VM provisionada, pareamento, entrega verificada e CMD efetivamente desligado.
