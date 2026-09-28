# Política de armazenamento — Drive First

## Regra do Play Moments

O Google Drive é o servidor principal de arquivos do produto. O Supabase deve permanecer como banco operacional leve e camada de autenticação, autorização, relacionamentos e metadados.

### Google Drive
Usar por padrão para arquivos binários e conteúdo pesado: vídeos, imagens, PDFs, certificados, timbrados, assinaturas, materiais de cursos, anexos, entregas, documentos e arquivos de projetos/clientes.

### Supabase
Usar para Auth, perfis, permissões/RLS, IDs, cursos/módulos/aulas, matrículas, progresso, avaliações/notas, CRM, pedidos/pagamentos, tarefas, configurações e referências aos arquivos do Drive (por exemplo `drive_file_id`, nome, MIME, tamanho, pasta e vínculo).

### Critério de implementação
Não criar novos buckets/fluxos de Supabase Storage quando o arquivo puder ser armazenado no Google Drive. Exceções devem ser justificadas tecnicamente. Arquivos legados no Storage podem continuar com fallback temporário até migração/remoção segura.

### Academia e certificados
Vídeos e materiais permanecem no Drive. Timbrado e assinatura dos modelos passam a ser enviados ao Drive. PDFs oficiais de certificados ficam no Drive. O Supabase guarda o registro do certificado, snapshots, código de verificação e IDs dos arquivos.
