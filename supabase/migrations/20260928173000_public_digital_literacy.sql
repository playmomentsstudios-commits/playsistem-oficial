-- Produto 03: curso público e gratuito de Letramento Digital.
begin;

create or replace function public.academy_public_course(course_slug text)
returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'course', to_jsonb(c),
    'modules', coalesce((
      select jsonb_agg(
        to_jsonb(m) || jsonb_build_object('lessons', coalesce((
          select jsonb_agg(to_jsonb(l) order by l.display_order)
          from public.course_lessons l
          where l.module_id=m.id and l.status='published'
        ),'[]'::jsonb))
        order by m.display_order
      )
      from public.course_modules m where m.course_id=c.id
    ),'[]'::jsonb)
  )
  from public.courses c
  where c.slug=course_slug and c.status='published' and c.access_type='free'
  limit 1
$$;
revoke all on function public.academy_public_course(text) from public;
grant execute on function public.academy_public_course(text) to anon,authenticated;

do $seed$
declare cid uuid; mid uuid; m jsonb; l jsonb; mo integer:=0; lo integer;
data jsonb := $data$[
 {"title":"01 — Tecnologia é linguagem e autonomia","description":"Entender tecnologia para além do aparelho: leitura do mundo digital, autonomia e aprendizado contínuo.","lessons":[
  {"title":"Letramento digital: muito além de saber apertar botões","description":"O que significa compreender tecnologia, tomar decisões e aprender novas ferramentas sem depender de decorar cada aplicativo.","duration":420},
  {"title":"Aprender fazendo: curiosidade, erro e autonomia","description":"Como experimentar com segurança, pesquisar soluções e transformar dificuldade tecnológica em processo de aprendizagem.","duration":420}
 ]},
 {"title":"02 — Sistemas, organização e vida digital","description":"A lógica que conecta celular, computador, aplicativos, arquivos e serviços digitais.","lessons":[
  {"title":"Todo aplicativo faz parte de um sistema","description":"Contas, dispositivos, aplicativos, arquivos e internet como partes conectadas de uma mesma experiência digital.","duration":480},
  {"title":"Organização digital também é produtividade","description":"Pastas, nomes, backups, nuvem e hábitos simples que evitam perda de tempo e informação.","duration":420}
 ]},
 {"title":"03 — Comunicação, informação e responsabilidade","description":"Participar do ambiente digital entendendo alcance, contexto, fontes e responsabilidade.","lessons":[
  {"title":"Comunicar não é apenas publicar","description":"Como contexto, linguagem, público e intenção transformam uma mensagem no ambiente digital.","duration":480},
  {"title":"Informação, fontes e o cuidado antes de compartilhar","description":"Leitura crítica, origem, data, contexto e práticas para reduzir desinformação e encaminhamentos impulsivos.","duration":480}
 ]},
 {"title":"04 — Algoritmos e inteligência artificial","description":"Uma introdução prática ao funcionamento das recomendações, algoritmos e ferramentas de IA.","lessons":[
  {"title":"Por que a internet mostra certas coisas para você?","description":"Uma explicação acessível sobre dados, recomendações, algoritmos e personalização das plataformas.","duration":480},
  {"title":"IA como ferramenta: pedir, conferir e decidir","description":"Como conversar com ferramentas de IA, revisar resultados, proteger informações e manter o julgamento humano.","duration":540}
 ]},
 {"title":"05 — Território, identidade e tecnologia","description":"Tecnologia também registra memória, amplia vozes e conecta conhecimento, território e comunidade.","lessons":[
  {"title":"Tecnologia, memória e ancestralidade","description":"O digital como meio de registrar histórias, preservar conhecimentos e ampliar a presença de comunidades e territórios.","duration":480},
  {"title":"Criar tecnologia a partir da própria realidade","description":"Não apenas consumir ferramentas: observar problemas locais, comunicar soluções e produzir conhecimento com identidade.","duration":480}
 ]},
 {"title":"06 — Autonomia, trabalho e próximos caminhos","description":"Transformar letramento digital em possibilidades concretas de estudo, criação, renda e participação.","lessons":[
  {"title":"Do uso cotidiano às possibilidades profissionais","description":"Design, audiovisual, comunicação, programação, produção de conteúdo e outras portas que podem começar pela prática.","duration":540},
  {"title":"Seu próximo passo no digital","description":"Um fechamento orientado à ação: escolher uma habilidade, praticar, produzir algo real e continuar aprendendo.","duration":420}
 ]}
]$data$::jsonb;
begin
 insert into public.courses(title,slug,description,content_type,status,access_type,instructor_name,estimated_minutes,category,published_at)
 values('Letramento Digital — tecnologia, autonomia e futuro','letramento-digital',
 'Curso gratuito para entender o mundo digital de forma prática e consciente: sistemas, comunicação, informação, algoritmos, inteligência artificial, identidade, território e possibilidades profissionais.',
 'course','published','free','Felipe Costa',93,'Tecnologia',now())
 on conflict(slug) do update set status='published',access_type='free',published_at=coalesce(public.courses.published_at,now()),updated_at=now()
 returning id into cid;
 if not exists(select 1 from public.course_modules where course_id=cid) then
  for m in select value from jsonb_array_elements(data) loop
   insert into public.course_modules(course_id,title,description,display_order) values(cid,m->>'title',m->>'description',mo) returning id into mid;
   lo:=0;
   for l in select value from jsonb_array_elements(m->'lessons') loop
    insert into public.course_lessons(module_id,title,description,duration_seconds,display_order,status,video_source,is_preview)
    values(mid,l->>'title',l->>'description',(l->>'duration')::integer,lo,'published','none',true);
    lo:=lo+1;
   end loop;
   mo:=mo+1;
  end loop;
 end if;
end
$seed$;
commit;
