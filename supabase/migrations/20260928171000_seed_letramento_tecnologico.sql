-- Produto 02: Letramento Tecnológico — estrutura inicial publicada com atividades temporizadas.
begin;
do $seed$
declare
  cid uuid;
  mid uuid;
  aid uuid;
  m jsonb;
  l jsonb;
  q jsonb;
  mo integer := 0;
  lo integer;
  qo integer;
  data jsonb := $data$[
    {"title":"01 — Celular: domínio do básico","description":"Android e iPhone, configurações essenciais, aplicativos, câmera e organização.","lessons":[
      {"title":"Conhecendo seu celular e as configurações essenciais","duration":360},
      {"title":"Aplicativos, permissões e atualizações","duration":420},
      {"title":"Câmera, scanner e recursos úteis do dia a dia","duration":420}
    ],"questions":[
      {"p":"Antes de instalar ou permitir acesso a um aplicativo, qual é a melhor prática?","o":["Aceitar tudo automaticamente","Verificar a função do app e conceder somente permissões necessárias","Desativar a senha do celular","Compartilhar o código de desbloqueio"],"c":1},
      {"p":"Para digitalizar um documento pelo celular, o mais adequado é:","o":["Fotografar sem conferir o enquadramento","Usar câmera ou recurso de scanner e conferir legibilidade antes de enviar","Enviar qualquer imagem da galeria","Diminuir a qualidade até o texto sumir"],"c":1},
      {"p":"Qual hábito ajuda a manter o celular organizado?","o":["Instalar vários apps iguais","Ignorar atualizações para sempre","Organizar apps e remover o que não é utilizado","Salvar tudo apenas em conversas"],"c":2}
    ]},
    {"title":"02 — Internet, navegador e comunicação","description":"Navegação, pesquisa, e-mail, WhatsApp, downloads, uploads e compartilhamento.","lessons":[
      {"title":"Navegador, pesquisa e leitura de resultados","duration":420},
      {"title":"E-mail na prática: enviar, responder e anexar","duration":480},
      {"title":"WhatsApp e compartilhamento com mais organização","duration":420}
    ],"questions":[
      {"p":"Ao pesquisar uma informação importante na internet, o que aumenta a confiabilidade?","o":["Abrir apenas o primeiro resultado","Comparar fonte, data e contexto","Confiar em qualquer encaminhamento","Usar somente títulos"],"c":1},
      {"p":"No e-mail, para enviar um documento junto da mensagem você deve usar:","o":["Anexo","Assunto","Spam","Rascunho"],"c":0},
      {"p":"Antes de encaminhar uma informação pelo WhatsApp, é recomendável:","o":["Encaminhar imediatamente","Verificar a origem e o conteúdo","Apagar o nome do autor e publicar","Adicionar informações que não estavam na fonte"],"c":1}
    ]},
    {"title":"03 — Arquivos, PDF e nuvem","description":"Arquivos e pastas, PDF, armazenamento em nuvem, download, upload e compartilhamento.","lessons":[
      {"title":"Arquivos e pastas sem confusão","duration":420},
      {"title":"PDF: criar, abrir, salvar e compartilhar","duration":420},
      {"title":"Nuvem, backup, download e upload","duration":480}
    ],"questions":[
      {"p":"Qual nome de arquivo facilita encontrá-lo depois?","o":["documento-final-contrato-2026.pdf","arquivo.pdf","novo(17).pdf","semnome.pdf"],"c":0},
      {"p":"Qual é a diferença básica entre download e upload?","o":["São exatamente a mesma coisa","Download traz um arquivo para seu dispositivo; upload envia um arquivo para um serviço","Upload apaga o arquivo","Download só funciona com PDF"],"c":1},
      {"p":"Uma vantagem do armazenamento em nuvem é:","o":["Eliminar a necessidade de senha","Acessar arquivos autorizados em diferentes dispositivos e manter cópias sincronizadas","Tornar todo arquivo público","Dispensar organização"],"c":1}
    ]},
    {"title":"04 — Computador e produtividade","description":"Windows, pastas, atalhos, documentos, instalação de programas e integração celular-computador.","lessons":[
      {"title":"Windows, janelas, arquivos e pastas","duration":480},
      {"title":"Documentos, atalhos e produtividade básica","duration":480},
      {"title":"Integração entre celular e computador","duration":420}
    ],"questions":[
      {"p":"No computador, pastas servem principalmente para:","o":["Organizar arquivos","Aumentar a velocidade da internet","Criar senhas automaticamente","Substituir programas"],"c":0},
      {"p":"Antes de instalar um programa, o que deve ser verificado?","o":["A origem do instalador e se o programa é realmente necessário","Somente a cor do ícone","Se um desconhecido enviou o arquivo","Nada"],"c":0},
      {"p":"Para continuar um trabalho entre celular e computador, uma prática útil é:","o":["Criar várias versões sem nome","Usar armazenamento sincronizado ou transferência organizada","Enviar tudo para grupos públicos","Remover a extensão dos arquivos"],"c":1}
    ]},
    {"title":"05 — Segurança digital e IA básica","description":"Senhas, golpes, privacidade, responsabilidade digital e uso inicial de inteligência artificial.","lessons":[
      {"title":"Senhas, autenticação e proteção de contas","duration":480},
      {"title":"Golpes, links suspeitos e privacidade","duration":480},
      {"title":"IA no cotidiano: pedir, conferir e decidir","duration":480}
    ],"questions":[
      {"p":"Qual opção fortalece a segurança de uma conta?","o":["Reutilizar a mesma senha em tudo","Usar senha forte e autenticação em duas etapas quando disponível","Enviar a senha por mensagem","Desativar bloqueios"],"c":1},
      {"p":"Você recebe uma mensagem urgente pedindo senha ou código. O que fazer primeiro?","o":["Enviar o código","Clicar no link imediatamente","Confirmar a solicitação por canal oficial antes de agir","Repassar para contatos"],"c":2},
      {"p":"Ao usar IA para uma tarefa importante, qual prática continua necessária?","o":["Aceitar toda resposta como fato","Revisar e conferir informações antes de usar","Fornecer senhas para melhorar a resposta","Eliminar julgamento humano"],"c":1}
    ]}
  ]$data$::jsonb;
begin
  insert into public.courses(title,slug,description,content_type,status,access_type,instructor_name,estimated_minutes,category,published_at)
  values('Letramento Tecnológico — tecnologia de forma clara, prática e acessível','letramento-tecnologico',
    'Formação prática em celular, internet, comunicação, arquivos, nuvem, computador, segurança digital e inteligência artificial básica. Conteúdo organizado para desenvolver autonomia no uso cotidiano da tecnologia.',
    'course','published','manual','Felipe Costa',111,'Tecnologia',now())
  on conflict(slug) do update set status='published', published_at=coalesce(public.courses.published_at,now()), updated_at=now()
  returning id into cid;

  if exists(select 1 from public.course_modules where course_id=cid) then
    raise notice 'Letramento Tecnológico já possui módulos; seed de conteúdo não duplicado.';
    return;
  end if;

  for m in select value from jsonb_array_elements(data) loop
    insert into public.course_modules(course_id,title,description,display_order)
    values(cid,m->>'title',m->>'description',mo) returning id into mid;
    lo:=0;
    for l in select value from jsonb_array_elements(m->'lessons') loop
      insert into public.course_lessons(module_id,title,description,duration_seconds,display_order,status,video_source,is_preview)
      values(mid,l->>'title','Aula prática do curso Letramento Tecnológico. O vídeo e os materiais complementares podem ser adicionados no editor da Academia.',(l->>'duration')::integer,lo,'published','none',false);
      lo:=lo+1;
    end loop;
    insert into public.academy_assessments(module_id,title,kind,instructions,status,timed,max_attempts,passing_percent)
    values(mid,'Atividade — '||(m->>'title'),'activity','Responda uma questão por vez. Cada questão vale 10 pontos e possui 60 segundos. Revise o módulo antes de iniciar.','published',true,2,70)
    returning id into aid;
    qo:=0;
    for q in select value from jsonb_array_elements(m->'questions') loop
      insert into public.academy_questions(assessment_id,prompt,options,correct_option,points,seconds,display_order)
      values(aid,q->>'p',q->'o',(q->>'c')::integer,10,60,qo);
      qo:=qo+1;
    end loop;
    mo:=mo+1;
  end loop;
end
$seed$;
commit;
