-- Draft activities for Produto 01 only. Evaluations remain optional.
begin;
do $seed$
declare cid uuid; mid uuid; aid uuid; item jsonb; q jsonb; pos integer;
begin
 select id into cid from public.courses where slug='do-zero-ao-digital';
 if cid is null then raise notice 'Produto 01 ausente: cadastre o curso antes de executar este seed.'; return; end if;
 for item in select value from jsonb_array_elements($data$[
  {
    "order": 0,
    "title": "Atividade do módulo 1 — Teste seu conhecimento",
    "questions": [
      {
        "prompt": "Qual frase apresenta uma oferta mais clara?",
        "options": [
          "Faço muitas coisas no digital.",
          "Tenho qualidade e dedicação.",
          "Produzo caixas de doces para pequenas comemorações, com retirada agendada.",
          "Sou apaixonado pelo meu trabalho."
        ],
        "correct_option": 2,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Antes de divulgar uma oferta, o que precisa estar definido?",
        "options": [
          "Todas as redes sociais possíveis.",
          "Entrega, limites, prazo e próximo passo.",
          "Uma equipe completa.",
          "Um logo caro."
        ],
        "correct_option": 1,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Qual é o objetivo do diagnóstico inicial?",
        "options": [
          "Escolher uma habilidade, recursos disponíveis e uma dificuldade para trabalhar.",
          "Garantir uma renda no primeiro mês.",
          "Copiar todos os resultados do instrutor.",
          "Comprar ferramentas antes de escolher o projeto."
        ],
        "correct_option": 0,
        "points": 10,
        "seconds": 60
      }
    ]
  },
  {
    "order": 1,
    "title": "Atividade do módulo 2 — Teste seu conhecimento",
    "questions": [
      {
        "prompt": "Como escolher os primeiros canais digitais?",
        "options": [
          "Abrir conta em todas as redes.",
          "Escolher onde o público descobre a oferta e como entra em contato.",
          "Usar apenas o canal com mais efeitos visuais.",
          "Trocar de canal todos os dias."
        ],
        "correct_option": 1,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Um perfil explica a oferta, mas seu link de contato não funciona. O que priorizar?",
        "options": [
          "Criar mais dez publicações.",
          "Mudar todas as cores.",
          "Aumentar o preço.",
          "Corrigir e testar o caminho de contato como um visitante."
        ],
        "correct_option": 3,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Você ainda não tem trabalhos de clientes para mostrar. Qual prática é adequada?",
        "options": [
          "Inventar depoimentos.",
          "Usar trabalhos alheios como se fossem seus.",
          "Criar uma demonstração e identificá-la como exemplo.",
          "Afirmar que já atendeu centenas de clientes."
        ],
        "correct_option": 2,
        "points": 10,
        "seconds": 60
      }
    ]
  },
  {
    "order": 2,
    "title": "Atividade do módulo 3 — Teste seu conhecimento",
    "questions": [
      {
        "prompt": "Reaproveitar conteúdo com intenção significa:",
        "options": [
          "Copiar uma publicação de outro profissional.",
          "Adaptar uma peça própria para formatos e funções diferentes.",
          "Repetir a mesma mensagem em todos os lugares sem ajustes.",
          "Publicar sem saber o objetivo."
        ],
        "correct_option": 1,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Ao usar IA para escrever uma legenda, qual etapa continua sendo sua responsabilidade?",
        "options": [
          "Publicar imediatamente.",
          "Informar dados privados dos clientes.",
          "Aceitar toda promessa sugerida.",
          "Revisar fatos, oferta e tom antes de publicar."
        ],
        "correct_option": 3,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Qual é um bom ponto de partida para um roteiro de conteúdo?",
        "options": [
          "Uma dúvida real do público e uma função definida para a peça.",
          "Um efeito visual sem relação com a oferta.",
          "Uma promessa de resultado garantido.",
          "A lista de todas as ferramentas do mercado."
        ],
        "correct_option": 0,
        "points": 10,
        "seconds": 60
      }
    ]
  },
  {
    "order": 3,
    "title": "Atividade do módulo 4 — Teste seu conhecimento",
    "questions": [
      {
        "prompt": "Qual situação pede atendimento humano?",
        "options": [
          "Informação fixa sobre horário.",
          "Link do catálogo.",
          "Problema específico depois da entrega.",
          "Explicação padronizada de como solicitar."
        ],
        "correct_option": 2,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Qual é a melhor coleta inicial para organizar um pedido?",
        "options": [
          "Pedir todos os dados pessoais possíveis.",
          "Solicitar somente informações necessárias à entrega ou ao orçamento.",
          "Não registrar nada.",
          "Publicar as informações do cliente em uma planilha aberta."
        ],
        "correct_option": 1,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "O que testar antes de usar uma resposta rápida?",
        "options": [
          "Se ela parece escrita por um robô.",
          "Se contém o maior texto possível.",
          "Se promete resposta imediata mesmo sem disponibilidade.",
          "Se é correta para aquele caso e quais trechos precisam de adaptação."
        ],
        "correct_option": 3,
        "points": 10,
        "seconds": 60
      }
    ]
  },
  {
    "order": 4,
    "title": "Atividade do módulo 5 — Teste seu conhecimento",
    "questions": [
      {
        "prompt": "O que deve acontecer antes da primeira divulgação?",
        "options": [
          "Testar oferta, vitrine, contato e solicitação como cliente.",
          "Esperar a identidade visual ficar perfeita para sempre.",
          "Assinar várias ferramentas.",
          "Publicar resultados ainda não medidos."
        ],
        "correct_option": 0,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Se há visitas, mas ninguém faz contato, qual é uma investigação coerente?",
        "options": [
          "Concluir imediatamente que o negócio não funciona.",
          "Inventar uma taxa de conversão positiva.",
          "Verificar clareza da oferta e funcionamento do caminho de contato.",
          "Mudar tudo sem registrar o que aconteceu."
        ],
        "correct_option": 2,
        "points": 10,
        "seconds": 60
      },
      {
        "prompt": "Depois de montar a primeira versão, como continuar?",
        "options": [
          "Trocar de estratégia a cada hora.",
          "Escolher um gargalo, testar uma melhoria e observar dados reais.",
          "Garantir que todos os alunos terão o mesmo resultado.",
          "Comprar ferramentas sem avaliar a necessidade."
        ],
        "correct_option": 1,
        "points": 10,
        "seconds": 60
      }
    ]
  }
]$data$::jsonb) loop
  select id into mid from public.course_modules where course_id=cid and display_order=(item->>'order')::integer order by created_at,id limit 1;
  if mid is null then continue; end if;
  if exists(select 1 from public.academy_assessments where module_id=mid and title=item->>'title') then continue; end if;
  insert into public.academy_assessments(module_id,title,kind,instructions,status,timed,max_attempts,passing_percent)
  values(mid,item->>'title','activity','Responda a três questões sobre o módulo. Cada questão vale 10 pontos e tem 60 segundos. Não é possível voltar após confirmar. Revise as aulas antes de iniciar.','draft',true,2,70) returning id into aid;
  pos:=0;
  for q in select value from jsonb_array_elements(item->'questions') loop
   insert into public.academy_questions(assessment_id,prompt,options,correct_option,points,seconds,display_order)
   values(aid,q->>'prompt',q->'options',(q->>'correct_option')::integer,10,60,pos);
   pos:=pos+1;
  end loop;
 end loop;
end $seed$;
commit;
