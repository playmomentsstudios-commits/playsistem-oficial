# Sagamente — notificações nativas Push (PWA V1)

## Para ativar

1. Acesse o Sagamente pelo domínio HTTPS oficial, entre em sua conta.
2. No celular, instale o PWA; no iPhone (iOS 16.4+), use **Compartilhar → Adicionar à Tela de Início** e ABRA pelo ícone instalado. Em Android e desktop, o botão funciona em navegadores compatíveis.
3. Abra **🔔 Notificações Push** pelo menu da conta. Clientes também têm a opção em **Minha Conta → Configurações → Notificações**.
4. Selecione mensagens, projetos, arquivos, prazos e/ou comercial e clique **Ativar notificações**. Autorize no sistema operacional.
5. Clique **Enviar teste** e aguarde o aviso. Caso não apareça, confira bloqueios de foco, permissões, modo economia de bateria e funcionamento do navegador.
6. Um aviso leva ao conteúdo autorizado em /app ou /admin. Sem permissão ao arquivo ou projeto não deve haver aviso.

## Arquitetura e manutenção

- Origem: public.notifications já alimentada pelos gatilhos de mensagens/projetos/arquivos.
- public.push_subscriptions: um registro por endpoint, máximo cinco endpoints por usuário. RLS ativo e nenhum acesso de navegador à tabela.
- push_private.config: segredo de despacho e VAPID PRIVADO em esquema fora da API. A chave pública é retornada na primeira visita autenticada; nenhum segredo é colocado no repositório/frontend.
- push_delivery_queue: processamento idempotente com SKIP LOCKED, 5 tentativas, retries, deduplicação curta de eventos antigos que geram notificações em duplicidade.
- pg_net: envio assíncrono para push-dispatch após inserção de notificação; pg_cron: recuperação a cada minuto.
- Edge Functions: push-control valida usuário e administra assinaturas; push-dispatch autentica segredo interno, valida destinatário, permissões, preferências e entrega via Web Push.
- Conteúdo no banner propositalmente genérico, sem nomes de arquivos ou informações confidenciais.
- Ao sair da conta, o navegador se desinscreve. Em aparelho compartilhado, cada pessoa deve habilitar novamente ao entrar.
- Não há cobrança Apple/Google para usar o padrão Web Push. Podem existir limites normais de execução e de banda dos fornecedores.

## Cuidados de produção

- As duas Edge Functions precisam estar publicadas com a mesma base de dados da migration:
  - push-control: verify_jwt=true.
  - push-dispatch: verify_jwt=false pois exige cabeçalho aleatório `x-sagamente-dispatch` validado contra segredo não público da base.
- Não exponha push_private.config, suas chaves, filas ou push_subscriptions ao usuário/browser. Nunca inclua o segredo em arquivo do GitHub, logs ou respostas HTTP.
- Caso a chave VAPID seja rotacionada, as assinaturas antigas precisarão ser recriadas nos dispositivos.
- Verificar `select jobname,active from cron.job where jobname='sagamente-push-v1';` e contagem/estado da fila por SQL autorizado.
- A entrega em segundo plano não exige o PWA aberto, mas depende de acesso à rede, permissão ativa e das políticas de cada sistema.
- O teste por dispositivo pode retornar *enfileirado* antes da entrega efetiva: valide o aviso no sistema e, caso necessário, a fila e logs do Edge.
