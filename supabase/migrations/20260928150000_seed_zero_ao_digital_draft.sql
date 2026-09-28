-- Produto 01: draft curriculum only. Never publish, enroll or create fake media.
-- Atomic and non-destructive: an existing course with this slug is left untouched.
begin;
do $seed$
declare
  course_id_new uuid;
  module_id_new uuid;
  module_item jsonb;
  lesson_item jsonb;
  module_position integer := 0;
  lesson_position integer;
  curriculum jsonb := $curriculum$[
  {
    "title": "01 — O que você vende: oferta clara",
    "description": "Transformar uma habilidade em uma oferta compreensível, com público, entrega e próximo passo.",
    "lessons": [
      {
        "title": "Boas-vindas e diagnóstico do seu ponto de partida",
        "description": "Objetivo\nIdentificar a habilidade, os recursos disponíveis e a principal dificuldade para começar.\n\nConteúdo da aula\nAnote o que sabe fazer, para quem já fez, qual dispositivo possui e quanto tempo consegue reservar. Escolha apenas um projeto para aplicar o curso.\n\nAtividade prática\nPreencha um diagnóstico com habilidade, público possível, recursos e dificuldade principal.\n\nCritério de conclusão\nVocê escolheu um projeto real e uma dificuldade que pode trabalhar durante o curso.\n\nMaterial de apoio previsto\nDiagnóstico inicial (modelo a produzir).\n\nDuração estimada do vídeo: 3 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 180
      },
      {
        "title": "Da habilidade à frase de oferta",
        "description": "Objetivo\nExplicar o que oferece, para quem e qual problema ajuda a resolver.\n\nConteúdo da aula\nSepare habilidade de entrega. Preencha: Eu ajudo [público] a [resultado possível] por meio de [entrega]. Troque termos vagos por uma situação concreta. Exemplo: caixas de doces para pequenas comemorações, com retirada agendada.\n\nAtividade prática\nEscreva duas versões da oferta e escolha a mais fácil de entender.\n\nCritério de conclusão\nOutra pessoa consegue dizer o que você oferece e para quem, sem uma explicação adicional.\n\nMaterial de apoio previsto\nModelo de frase de oferta (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      },
      {
        "title": "Escopo, limites e próximo passo",
        "description": "Objetivo\nDefinir uma entrega inicial e como o cliente solicita.\n\nConteúdo da aula\nListe o que está incluído, o que não está, prazo possível e informações necessárias. Separe custo de preço; não use um preço de exemplo como regra. Defina um único próximo passo: consultar disponibilidade, pedir orçamento ou comprar.\n\nAtividade prática\nMonte uma ficha com entrega, limites, prazo e chamada para ação.\n\nCritério de conclusão\nA ficha permite entender o serviço sem depender de vários áudios.\n\nMaterial de apoio previsto\nFicha da oferta (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      }
    ]
  },
  {
    "title": "02 — Sua porta de entrada digital",
    "description": "Organizar uma presença mínima coerente e um caminho claro até o atendimento.",
    "lessons": [
      {
        "title": "Escolha dos canais e identidade básica",
        "description": "Objetivo\nEscolher um canal de descoberta e um de contato com base no público.\n\nConteúdo da aula\nObserve onde o público procura o serviço. Defina nome legível, foto ou marca simples e uma descrição coerente. Evite abrir vários canais sem conseguir mantê-los. Use a mesma identificação nos canais escolhidos.\n\nAtividade prática\nRegistre seus dois canais principais e organize nome, imagem e descrição.\n\nCritério de conclusão\nA identificação é consistente e o contato é fácil de encontrar.\n\nMaterial de apoio previsto\nChecklist de identidade e canais (a produzir).\n\nDuração estimada do vídeo: 4 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 240
      },
      {
        "title": "Perfil, apresentação e chamada para ação",
        "description": "Objetivo\nOrganizar uma apresentação que explique a oferta e o contato.\n\nConteúdo da aula\nRevise nome, descrição, exemplos de trabalho e chamada para ação. Demonstre a função desses elementos em um perfil de exemplo; a posição dos botões pode mudar. Não use depoimentos ou resultados inventados. Teste o caminho a partir de outro dispositivo.\n\nAtividade prática\nReescreva a apresentação e teste seu botão ou link de contato.\n\nCritério de conclusão\nAlguém consegue entender a oferta e chegar ao canal certo sem pedir instruções.\n\nMaterial de apoio previsto\nModelo de apresentação e checklist do perfil (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      },
      {
        "title": "Catálogo ou portfólio mínimo e contato organizado",
        "description": "Objetivo\nApresentar uma oferta com exemplos e informações suficientes para solicitar.\n\nConteúdo da aula\nOrganize três itens ou exemplos autorizados, com nome, descrição, escopo e forma de solicitar. Use catálogo ou página simples conforme o canal. No contato profissional, informe horários e prazo de resposta possível. Verifique os recursos gratuitos disponíveis antes da gravação.\n\nAtividade prática\nMonte sua vitrine mínima e faça uma simulação de pedido.\n\nCritério de conclusão\nO visitante encontra os exemplos, entende os limites e sabe como solicitar.\n\nMaterial de apoio previsto\nModelo de catálogo/portfólio e checklist de contato (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      }
    ]
  },
  {
    "title": "03 — Conteúdo que trabalha por você",
    "description": "Criar uma peça principal e reaproveitá-la com intenção, usando IA com revisão humana.",
    "lessons": [
      {
        "title": "Conteúdo com função e roteiro simples",
        "description": "Objetivo\nPlanejar um conteúdo que explique ou demonstre a oferta.\n\nConteúdo da aula\nEscolha uma dúvida real. Estruture abertura, demonstração, explicação e chamada para ação. Defina se a peça serve para descoberta, confiança, explicação ou contato. Grave com os recursos disponíveis, cuidando da clareza do áudio.\n\nAtividade prática\nEscreva um roteiro curto a partir de uma pergunta comum do público.\n\nCritério de conclusão\nO roteiro responde uma dúvida e termina com uma ação coerente.\n\nMaterial de apoio previsto\nRoteiro de conteúdo principal (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      },
      {
        "title": "Uma peça principal, três reaproveitamentos",
        "description": "Objetivo\nTransformar um conteúdo original em formatos complementares.\n\nConteúdo da aula\nProduza uma demonstração e derive um corte curto, uma sequência de imagens e uma resposta para dúvida frequente. Ajuste texto, enquadramento e chamada ao contexto. Use apenas imagens, áudio e exemplos próprios ou autorizados.\n\nAtividade prática\nCrie a peça principal e planeje ou produza suas três derivações.\n\nCritério de conclusão\nAs quatro peças têm funções identificadas e podem ser usadas sem repetir a mesma mensagem integralmente.\n\nMaterial de apoio previsto\nMapa de reaproveitamento de conteúdo (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      },
      {
        "title": "IA prática para organizar e revisar",
        "description": "Objetivo\nUsar IA como apoio sem perder identidade nem publicar erros.\n\nConteúdo da aula\nForneça contexto, público, objetivo e formato usando dados fictícios. Peça um primeiro rascunho. Compare com a oferta, remova fatos inventados e revise o tom. Não insira dados pessoais de clientes. Use alternativa manual quando a ferramenta não estiver disponível.\n\nAtividade prática\nGere ou escreva uma legenda, revise os fatos e registre o que você alterou.\n\nCritério de conclusão\nO texto final reflete a oferta real e foi revisado por você.\n\nMaterial de apoio previsto\nModelo de pedido à IA e checklist de revisão (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      }
    ]
  },
  {
    "title": "04 — Atendimento e automação leve",
    "description": "Organizar perguntas, respostas e acompanhamento sem perder o atendimento humano.",
    "lessons": [
      {
        "title": "Perguntas frequentes e cinco respostas rápidas",
        "description": "Objetivo\nReduzir repetição mantendo respostas claras e úteis.\n\nConteúdo da aula\nListe perguntas sobre oferta, prazo, preço ou orçamento, funcionamento e próximo passo. Escreva respostas curtas com campos que precisam ser adaptados. Configure atalhos se o canal permitir e teste antes de usar.\n\nAtividade prática\nPrepare cinco respostas e simule duas conversas com necessidades diferentes.\n\nCritério de conclusão\nAs respostas ajudam o cliente e não prometem disponibilidade ou prazo sem confirmação.\n\nMaterial de apoio previsto\nBanco de cinco respostas rápidas (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      },
      {
        "title": "Coleta de informações e organização dos pedidos",
        "description": "Objetivo\nReceber o mínimo necessário e acompanhar cada solicitação.\n\nConteúdo da aula\nDefina perguntas úteis para seu serviço: tipo de pedido, data quando pertinente, local quando necessário e contato. Organize etapas novo, aguardando informação, proposta enviada e concluído. Um formulário simples ou roteiro no atendimento pode cumprir a coleta. Restrinja o acesso aos registros.\n\nAtividade prática\nMonte a coleta e registre três pedidos fictícios em etapas diferentes.\n\nCritério de conclusão\nVocê consegue localizar cada pedido e identificar a próxima ação sem expor dados dos clientes.\n\nMaterial de apoio previsto\nModelo de coleta e acompanhamento (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      },
      {
        "title": "Automação leve, teste e passagem para uma pessoa",
        "description": "Objetivo\nDistinguir tarefas repetitivas de situações que exigem análise humana.\n\nConteúdo da aula\nDesenhe chegada, informações, resposta padrão e encaminhamento. Teste respostas incompletas, pedido personalizado e problema após a entrega. Informe quando houver mensagem automática. Não prometa integração ou envio automático que não foi configurado e testado.\n\nAtividade prática\nSimule o fluxo e defina três situações em que você assume a conversa.\n\nCritério de conclusão\nO cliente sabe o próximo passo e consegue chegar a uma pessoa nas exceções.\n\nMaterial de apoio previsto\nMapa do atendimento e checklist de teste (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      }
    ]
  },
  {
    "title": "05 — Publicar, medir e melhorar",
    "description": "Colocar a primeira versão em uso, registrar evidências e escolher uma melhoria por vez.",
    "lessons": [
      {
        "title": "Revisão final e publicação da primeira versão",
        "description": "Objetivo\nTestar a jornada antes de divulgar.\n\nConteúdo da aula\nConfira oferta, vitrine, contato, respostas e caminho de solicitação. Teste no celular com alguém que ainda não conhece a proposta. Corrija links e informações contraditórias. Escolha uma divulgação inicial que consiga atender.\n\nAtividade prática\nConclua a revisão e registre a primeira versão da sua presença digital.\n\nCritério de conclusão\nOferta e contato estão funcionais; nenhuma etapa depende de instrução que o visitante não recebe.\n\nMaterial de apoio previsto\nChecklist de publicação (a produzir).\n\nDuração estimada do vídeo: 5 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 300
      },
      {
        "title": "Métricas simples e diário do experimento",
        "description": "Objetivo\nRegistrar sinais para decidir o que melhorar sem confundir simulação com resultado.\n\nConteúdo da aula\nEscolha um período e registre visitas quando disponíveis, contatos, propostas, vendas confirmadas, tempo e custo. Compare etapas sem supor uma taxa ideal. Use dados fictícios na demonstração e identifique-os. No próprio projeto, registre números reais, inclusive zeros.\n\nAtividade prática\nPreencha o primeiro registro e escreva uma hipótese de melhoria.\n\nCritério de conclusão\nOs dados têm período definido e a hipótese indica o que observar no próximo teste.\n\nMaterial de apoio previsto\nDiário do experimento e planilha de métricas (a produzir).\n\nDuração estimada do vídeo: 6 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 360
      },
      {
        "title": "Plano de continuidade, entrega final e feedback",
        "description": "Objetivo\nConsolidar a estrutura e escolher uma próxima melhoria possível.\n\nConteúdo da aula\nRevise diagnóstico, oferta, presença, conteúdo, atendimento e registro de métricas. Escolha um gargalo e uma ação para os próximos sete dias. Registre o que funcionou e o que ficou confuso. O feedback deve relatar sua experiência sem prometer resultados para outros.\n\nAtividade prática\nReúna suas entregas e escreva a próxima ação, o prazo e como vai verificar a melhoria.\n\nCritério de conclusão\nVocê consegue explicar e manter o fluxo criado e sabe qual ajuste fará primeiro.\n\nMaterial de apoio previsto\nChecklist final e perguntas de feedback (a produzir).\n\nDuração estimada do vídeo: 4 minutos. O tempo de prática é adicional.\nVídeo e material serão adicionados antes da publicação.",
        "duration_seconds": 240
      }
    ]
  }
]$curriculum$::jsonb;
begin
  insert into public.courses (title,slug,description,content_type,status,access_type,instructor_name,estimated_minutes,category)
  values ('Do Zero ao Digital — faça muito com pouco','do-zero-ao-digital',
    'Construa uma oferta clara, uma presença digital funcional, conteúdo inicial e um atendimento organizado usando prioritariamente ferramentas gratuitas. Curso prático para quem tem uma habilidade, serviço ou ideia e quer começar com mais autonomia. Cinco módulos com exercícios aplicados ao seu projeto. Não há promessa de renda ou resultado financeiro. O tempo de prática é adicional à duração estimada das aulas.',
    'course','draft','manual','Felipe Costa',77,'Empreendedorismo digital')
  on conflict (slug) do nothing returning id into course_id_new;
  if course_id_new is null then
    raise notice 'Do Zero ao Digital já existe; nenhum conteúdo foi alterado.';
    return;
  end if;
  for module_item in select value from jsonb_array_elements(curriculum) loop
    insert into public.course_modules (course_id,title,description,display_order)
    values (course_id_new,module_item->>'title',module_item->>'description',module_position)
    returning id into module_id_new;
    lesson_position := 0;
    for lesson_item in select value from jsonb_array_elements(module_item->'lessons') loop
      insert into public.course_lessons (module_id,title,description,duration_seconds,display_order,status,video_source,is_preview)
      values (module_id_new,lesson_item->>'title',lesson_item->>'description',(lesson_item->>'duration_seconds')::integer,lesson_position,'draft','none',false);
      lesson_position := lesson_position + 1;
    end loop;
    module_position := module_position + 1;
  end loop;
end
$seed$;
commit;
