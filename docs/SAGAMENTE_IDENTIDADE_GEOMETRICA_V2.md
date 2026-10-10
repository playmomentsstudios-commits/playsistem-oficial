# SAGAMENTE — kit de identidade geométrica V2 (outubro/2026)

## Direção aprovada para desenvolvimento
- Símbolo em S isométrico com seis faces planas: **3 cobre (#B24B18)** e **3 branco (#FFFFFF)**. Fundo grafite **#1D1D20**. Versão clara usa grafite **#17191B** nas faces que seriam brancas.
- O S representa uma construção modular: geometria, solidez, criatividade, precisão e transformação.
- Logotipo principal **sem assinatura secundária**. Nada de "Design · Tecnologia · Comunicação" dentro da logo horizontal, vertical ou compacta.
- Render 3D metálico é aplicação publicitária / institucional, não substitui geometria vetorial, favicon ou logos de interface.
- Tipografia operacional: **Inter ExtraBold**, com fallback Montserrat/Arial. Definir saída em contornos na finalização gráfica do Adobe Illustrator.
- Paleta preexistente Terra UI #A65A2A continua nos estilos históricos, com migração para cobre #B24B18 por meio de `primary_color` **apenas quando publicada** e após contraste.

## Anatomia e proporção
- Símbolo tem base `viewBox="0 0 100 124"` (razão ~0,806).
- Margem de respiro mínima sugerida: **25 unidades** do módulo; mantenha a marca inteira em mesmo plano horizontal, sem deslocamento Z entre S e nome.
- Escala mínima sugerida: assinatura horizontal 180 px; marca isolada 32 px para leitura segura. A versão de 24 px requer teste em dispositivo.
- Ícones: 180 / 192 / 512 e `maskable` 512. Imagem social: 1200 × 630 PNG, porque algumas plataformas não mostram SVG OG.

## Aplicação no painel
A aba **Configurações do Site → Identidade da Marca** contém exatamente sete versões:

| Campo persistido | Arquivo base no deploy | Uso |
|---|---|---|
| `brand_logo_dark_url` | `/sagamente-logo-dark.svg` | Header, rodapé, login escuro |
| `brand_logo_light_url` | `/sagamente-logo-light.svg` | Fundos claros |
| `brand_logo_compact_url` | `/sagamente-logo-compact.svg` | Menu mobile, espaços estreitos |
| `brand_symbol_url` | `/sagamente-mark.svg` | Só símbolo, menu recolhido |
| `brand_staff_logo_url` | `/sagamente-logo-staff.svg` | Equipe no tema claro |
| `brand_favicon_url` | `/favicon.svg` | Favicon e favoritos |
| `brand_social_image_url` | subir arquivo `sagamente-social-1200x630.png` pelo painel | WhatsApp/LinkedIn com semântica OG |

A ação **Preparar versões V2** escolhe os seis SVG públicos e cobre #B24B18 no rascunho. A imagem social existente fica preservada até ser substituída por um PNG válido. O administrador confirma em **Publicar identidade**. Sem esse clique, o banco não muda.

Em **Aplicativo (PWA)**, os quatro tamanhos seguem controle separado no Drive. Atualizar no painel, usando `sagamente-app-base-512.svg` rasterizado a 512 PNG do kit e verificando versão maskable.

## Segurança e implantação
- A tabela `site_settings` já tem URLs próprias do Google Drive; uma mudança de arquivo estático por si só **não altera** o site enquanto esses campos apontam para o Drive.
- Nunca sobrescrever links existentes automaticamente durante deploy.
- Preservar dados, pagamentos, clientes, tabelas, credenciais, callbacks, históricos e documentos emitidos.
- Testar contraste e acessibilidade, PWA iOS/Android/desktop, SEO, OG e favicon depois de publicar.
