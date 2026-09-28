# Academia V1 — Marco de Homologação #200

## Corte oficial
O PR #200 é o marco de fechamento da Academia V1. Depois deste ponto, novas capacidades entram em V1.1/V2 e não alteram silenciosamente este baseline.

## Fluxo acadêmico autoritativo
Perfil acadêmico/RA → matrícula → estrutura curricular versionada → turma/oferta → aulas → atividades/avaliações → frequência quando exigida → progresso/resultado → conclusão → boletim/histórico → documentos → certificação.

## Módulos homologados
- Conteúdos, cursos, módulos e aulas
- Secretaria e ficha acadêmica do aluno
- Estrutura curricular versionada
- Turmas e ofertas
- Atividades, avaliações e resultados
- Frequência e regras de conclusão
- Boletim, histórico e eventos acadêmicos
- Documentos acadêmicos privados no Google Drive
- Contratos/termos e aceite versionado
- Assinatura acadêmica auditável
- Certificação e verificação
- Programas e trilhas
- RBAC acadêmico integrado a Colaboradores

## Armazenamento
Supabase: autenticação, dados estruturados, regras, RLS, metadados, hashes e relações.
Google Drive: vídeos, materiais, PDFs e demais binários pesados.

## Dependências operacionais
As migrations acadêmicas devem estar aplicadas em ordem. As Edge Functions do Drive documental precisam estar publicadas no projeto Supabase:
- academy-drive-documents
- academy-drive-document-finalize

## Backup do marco
Após o merge do #200 e validação de produção:
1. registrar o SHA do merge;
2. criar tag/branch de backup do marco;
3. exportar/guardar schema/migrations do Supabase;
4. preservar secrets/configuração das Edge Functions fora do repositório;
5. manter as pastas Drive sem alteração de IDs;
6. registrar o marco na planilha oficial.

## Reconstrução
Um ambiente novo deve ser reconstruído nesta ordem:
1. checkout do SHA/tag #200;
2. instalar dependências e executar typecheck/build;
3. criar/configurar Supabase e aplicar migrations em ordem;
4. configurar Auth/RLS;
5. configurar OAuth Google Drive e publicar Edge Functions;
6. configurar variáveis Vite/Netlify;
7. validar login admin, colaborador acadêmico e aluno;
8. executar o roteiro E2E abaixo.

## Roteiro E2E mínimo
1. Criar/selecionar curso.
2. Criar Estrutura Curricular ativa.
3. Criar Turma/Oferta vinculada.
4. Criar aluno/RA e matrícula.
5. Concluir aula e atividade/avaliação.
6. Registrar frequência quando exigida.
7. Atualizar matrícula e conferir progresso/nota/status.
8. Abrir boletim/histórico.
9. Emitir documento e confirmar arquivo no Drive + metadados no Supabase.
10. Registrar aceite de contrato/termo.
11. Registrar assinatura autorizada.
12. Concluir curso e validar certificado/verificação.
13. Vincular curso a Programa/Trilha e atualizar progresso.
14. Testar colaborador com permissão acadêmica e colaborador sem permissão.
15. Repetir caminhos essenciais em viewport mobile.

## Critério de mudança após #200
Correções de defeito podem ser aplicadas sobre a V1. Novos módulos, mudanças de semântica acadêmica ou alterações estruturais devem ser versionados e documentados como evolução posterior.
