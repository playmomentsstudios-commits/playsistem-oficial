# Atividades e avaliações da Academia

## Aplicação

Aplicar, nesta ordem, no Supabase do projeto:

1. `20260928160000_academy_assessments.sql`: tabelas, políticas e funções.
2. `20260928161000_seed_zero_digital_activities.sql`: cinco atividades em rascunho do Produto 01 (curso já cadastrado pelo SQL anterior).

O deploy do frontend não aplica SQL. Sem a primeira migration, a interface informa indisponibilidade; as videoaulas continuam independentes.

## Administração

Em Admin → Academia, selecione o curso. A seção “Atividades e avaliações dos módulos” permite criar qualquer modalidade em cada módulo. Configure título, instruções, enunciados, quatro alternativas (uma correta), pontos, segundos por questão, máximo de tentativas e meta percentual. O banco suporta 2 a 6 alternativas; o editor novo começa com quatro. O tempo pode ser desativado, inclusive para adaptação de acessibilidade. Avaliações começam sem temporizador; atividades começam com ele ativado. Ambas usam uma questão por tela nesta versão.

Cada atividade do Produto 01 vem com três questões, 60 segundos por questão, 10 pontos por resposta, duas tentativas e referência de 70%. Esses são valores iniciais editáveis, não regras obrigatórias de todos os cursos. Com três questões de igual peso, atingir 70% exige acertar as três; ajuste a meta se quiser aceitar dois acertos (66%).

Publicar uma atividade não publica o curso. O aluno precisa de curso publicado e matrícula ativa ou concluída. Para disponibilizar o Produto 01, revisar e publicar curso, aulas e atividades no momento apropriado. Não é criado exame obrigatório, bloqueio de curso ou certificado automático.

## Aluno

Atividades aparecem depois das aulas do respectivo módulo. Antes de iniciar, a tela explica tempo, tentativas, pontuação e ausência de retorno. O aluno confirma uma resposta; a próxima questão começa imediatamente. O prazo esgotado gera zero e avança. A pontuação e o resultado por questão aparecem somente após terminar.

Sair da página não pausa nem reinicia o prazo da questão atual. Ao retomar, se esse prazo expirou, ela é registrada como esgotada e a próxima começa naquele momento. Não é um tempo global de prova. Em falha de conexão, o botão de retomar sincroniza com o servidor: uma resposta que só chegou depois do prazo não recebe pontos. Abas concorrentes e reenvios não pontuam duas vezes.

## Integridade

O servidor valida matrícula, publicação, alternativa e prazo com relógio próprio. O cliente não recebe o gabarito nem questões futuras. Snapshots, respostas e resultados completos não são selecionáveis diretamente por alunos. Toda pontuação é calculada no servidor. Tentativas usam bloqueio de linha; iniciar usa bloqueio da atividade, impedindo duplicar uma tentativa ativa ou ultrapassar o limite por chamadas simultâneas.

Depois de haver uma tentativa, a edição do conteúdo/configuração fica bloqueada para preservar as condições; pode retirar a publicação e criar nova versão. O admin pode consultar as tentativas por aluno. Retirar publicação suspende o acesso inclusive a tentativas em curso, portanto fazer isso conscientemente.

Temporizador reduz tempo de consulta, mas não garante prevenção de cola. Não há vigilância por câmera, detecção de troca de aba ou promessa de fiscalização. Atividades práticas de entrega de arquivo/texto e avaliação com todas as questões na mesma página não fazem parte desta versão.
