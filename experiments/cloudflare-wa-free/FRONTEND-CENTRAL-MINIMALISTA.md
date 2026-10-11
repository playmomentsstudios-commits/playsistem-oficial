# Central WhatsApp — diretriz visual minimalista (2026-10-11)

Referência: captura do painel em 11/10/2026. A preferência é uma tela de OPERAÇÃO, não uma tela de manual.

## Ordem de informação
1. Cabeçalho compacto: `Central WhatsApp`, indicador simples `Conectado / Desconectado` e botão discreto de ajustes.
2. Área principal: QR (somente quando desconectado), ou marca de conectado e número vinculado; ações `Conectar`, `Reconectar` e `Desconectar` de acordo com estado. Não mostrar ações incompatíveis.
3. Preferência de entrega em um seletor compacto; salvar somente se houver alteração.
4. Indicadores em linha compacta: `Pendentes`, `Enviadas`, `Falhas` (cada um com valor). Outras métricas ficam em área avançada.
5. Link de autorização de clientes: botão `Copiar link` e opção de abrir, dentro de `Configurações` ou menu secundário.
6. Área de logs e status técnicos ficam recolhidas em `Detalhes técnicos`.

## Remover da primeira tela
- Parágrafos orientativos, repetição de advertências, logs em texto corrido.
- Caixas repetidas de status/heartbeat/número, quando já houver indicador principal.
- Cards extensos de métricas zeradas, rodapés longos de contadores.
- Texto técnico sobre Node, pilota, limite de serviço, explicação de opt-in.

## Segurança funcional (não remover)
- Consentimento explícito e histórico de autorização.
- Confirmação antes de `Desconectar`, alterar modo que impacte envios ou liberar a operação.
- Alerta de erro real e consequências operacionais, apenas no momento relevante.
- Acesso admin, segregação de credenciais, limite de destinatários, auditoria — podem ficar ocultos visualmente, nunca desativados.

## UI / UX
Mobile-first; um painel centralizado, espaços respirados, texto curto, ícones legíveis, contraste alto; usar paleta e ícones Sagamente existentes. Ao conectar, o QR assume destaque, sem molduras redundantes. Loading e estado offline claros. Nada de mudança visual enquanto a arquitetura Baileys Cloudflare ainda não estiver aprovada; aplicar na fase E sem mesclar experimento em main.

## Critério de aceite
Tela principal cabe no viewport de desktop de referência, status e ação principal imediatamente identificáveis. Não há parágrafos explicativos permanentes. Tudo funcional com teclado, leitura acessível e celular.
