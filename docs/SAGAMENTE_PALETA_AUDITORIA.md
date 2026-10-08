# SAGAMENTE — auditoria e ajustes da paleta

Paleta institucional (aprovada para avaliação): Terra `#A65A2A`, Carvão `#0E0E0E`, Areia `#E7E1D7`, Verde Nativo `#2E5D46`, Bronze `#C48A3A`.

## Cores de interface
- Cor de ações/CTAs: `#A65A2A` (com texto branco; contraste sobre branco > 5:1).
- Texto em fundo escuro: `#DFA269` (contraste sobre `#0A0A0B` aproximadamente 8,96:1).
- Hover/ação pressionada: `#81431E`; nunca utilizar vermelho para navegação comum.
- Categorias de mercado: Studio `#DFA269`; Design `#C48A3A`; Tech `#72B596`.
- Estados operacionais: pendente cinza, em andamento amarelo, em revisão azul, concluído verde; erro/cancelamento vermelho.
- A paleta institucional NÃO substitui cores funcionais de pagamento, erro, sucesso, alerta e tarefas.

## Anomalias encontradas e corrigidas
1. `--color-brand-dim` vermelho legado em tema principal.
2. `.pm-eyebrow` rosa legado em subtítulos.
3. Brilho violeta isolado na Home animada.
4. Itens selecionados vermelhos em menu administrativo/cliente.
5. Três categorias com tons neon distintos da identidade.
6. Regra CSS do painel claro aplicava fundo de alerta rosa a um destaque cobre.
7. Destaques de texto cobre original no fundo escuro com contraste inferior a 4,5:1.
8. Cor das tags e selects de tarefas não refletia padrão operacional aprovado.

## Preservação
Nenhuma alteração em dados históricos, Supabase, permissões, arquivos, pedidos, pagamentos, rotas ou integração Drive. Revisão visual e testes desktop/mobile antes de merge/deploy. Não fazer atualização de DNS nem strings técnicas antigas nesta etapa.
