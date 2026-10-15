import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {CompactPageHeader} from '../../components/ui/CompactWorkspace'
import {portalApi} from '../../api/portal'
import {academyApi} from '../../api/academy'
import {academyLibraryAdminApi} from '../../api/academyLibraryAdmin'
import {supabase} from '../../lib/supabase'

type Counters={
 clients:number|null; projects:number|null; activeProjects:number|null; completedProjects:number|null;
 orders:number|null; quotes:number|null; acceptedQuotes:number|null; pendingPayments:number|null;
 courses:number|null; publishedCourses:number|null; lessons:number|null; enrollments:number|null;
 books:number|null; audiobooks:number|null; publishedMedia:number|null; activeGrants:number|null;
}
type PublicViews={
 period_days:number;total_views:number;today_views:number;
 by_type:Array<{content_type:string;total:number}>;
 daily:Array<{date:string;total:number}>;
 top_items:Array<{content_type:string;content_key:string;path:string;label:string;total:number}>;
}
const EMPTY:Counters={
 clients:null,projects:null,activeProjects:null,completedProjects:null,
 orders:null,quotes:null,acceptedQuotes:null,pendingPayments:null,
 courses:null,publishedCourses:null,lessons:null,enrollments:null,
 books:null,audiobooks:null,publishedMedia:null,activeGrants:null,
}
const typeLabels:Record<string,string>={page:'Páginas',product:'Produtos',service:'Serviços',resume:'Currículos',landing:'Landings',course:'Cursos'}
const nf=(value:number)=>value.toLocaleString('pt-BR')
const display=(value:number|null)=>value===null?'—':nf(value)
const formatDate=(date:string)=>{const parts=date.split('-');return parts.length===3?parts[2]+'/'+parts[1]:date}

function Metric({label,value,href,detail}:{label:string;value:number|null;href?:string;detail?:string}){
 const inside=<>
  <span className="text-xs text-gray-400">{label}</span>
  <strong className="mt-3 block text-2xl font-semibold tracking-tight text-white">{display(value)}</strong>
  {detail&&<span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{detail}</span>}
 </>
 const cls="block min-w-0 rounded-xl border border-white/[.08] bg-[#161719] p-4"
 return href?<Link className={cls+" transition-colors hover:border-[#DFA269]/35"} to={href}>{inside}</Link>
  :<div className={cls}>{inside}</div>
}
function Section({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){
 return <section className="space-y-3">
  <div><h2 className="text-base font-semibold text-gray-100">{title}</h2><p className="mt-1 text-xs text-gray-500">{subtitle}</p></div>
  {children}
 </section>
}
export function AdminMetricsDashboard(){
 const [counts,setCounts]=useState<Counters>(EMPTY)
 const [loading,setLoading]=useState(true)
 const [period,setPeriod]=useState<7|30|90>(30)
 const [views,setViews]=useState<PublicViews|null>(null)
 const [viewsLoading,setViewsLoading]=useState(true)
 const [viewsError,setViewsError]=useState('')

 useEffect(()=>{
  let active=true
  async function load(){
   // Each source is isolated: a failed module must never be represented as zero.
   const results=await Promise.allSettled([
    portalApi.customers(),portalApi.projects(),portalApi.orders(),portalApi.quotes(),portalApi.payments(),
    academyApi.adminCourses(),academyLibraryAdminApi.list(),
    supabase.from('course_lessons').select('id',{count:'exact',head:true}),
    supabase.from('course_enrollments').select('id',{count:'exact',head:true}),
    supabase.from('academy_library_grants').select('id',{count:'exact',head:true}).eq('active',true),
   ])
   if(!active)return
   const rows=(i:number):any[]|null=>results[i].status==='fulfilled'&&Array.isArray(results[i].value)?results[i].value as any[]:null
   const count=(i:number):number|null=>{
    const result=results[i]
    if(result.status!=='fulfilled')return null
    const response=result.value as {count?:number|null;error?:unknown}
    return response.error?null:(typeof response.count==='number'?response.count:null)
   }
   const clients=rows(0),projects=rows(1),orders=rows(2),quotes=rows(3),payments=rows(4),courses=rows(5),library=rows(6)
   setCounts({
    clients:clients?.length??null,
    projects:projects?.length??null,
    activeProjects:projects?.filter(p=>!['completed','cancelled'].includes(String(p.status))).length??null,
    completedProjects:projects?.filter(p=>p.status==='completed').length??null,
    orders:orders?.length??null,
    quotes:quotes?.length??null,
    acceptedQuotes:quotes?.filter(q=>q.status==='accepted').length??null,
    pendingPayments:payments?.filter(p=>!p.archived_at&&['pending','awaiting_confirmation'].includes(String(p.status))).length??null,
    courses:courses?.length??null,
    publishedCourses:courses?.filter(c=>c.status==='published').length??null,
    lessons:count(7),
    enrollments:count(8),
    books:library?.filter(i=>i.format==='ebook').length??null,
    audiobooks:library?.filter(i=>i.format==='audiobook').length??null,
    publishedMedia:library?.filter(i=>i.status==='published').length??null,
    activeGrants:count(9),
   })
   setLoading(false)
  }
  void load()
  return()=>{active=false}
 },[])

 useEffect(()=>{
  let active=true
  setViewsLoading(true);setViewsError('')
  void supabase.rpc('public_view_summary',{p_days:period}).then(({data,error})=>{
   if(!active)return
   if(error)throw error
   if(!data||typeof data!=='object')throw new Error('Resumo de visualizações não disponível.')
   setViews(data as PublicViews)
  }).catch(()=>{
   if(active){setViews(null);setViewsError('As visualizações não puderam ser consultadas. Confira a permissão de relatórios.')}
  }).finally(()=>{if(active)setViewsLoading(false)})
  return()=>{active=false}
 },[period])

 const maxDaily=useMemo(()=>Math.max(1,...(views?.daily||[]).map(item=>Number(item.total)||0)),[views])
 const days=(views?.daily||[]).slice(-30)
 const countedViews=views?.by_type||[]
 const top=views?.top_items||[]

 return <div className="mx-auto max-w-[1400px] space-y-7 pb-8">
  <CompactPageHeader eyebrow="Gestão e resultados" title="Dashboard de métricas"
   description="Acompanhe o desempenho quando quiser. Contagens operacionais são totais registrados; visualizações usam o período escolhido."
   actions={<Link to="/admin" className="pm-compact-tap rounded-lg border border-white/10 px-3 text-xs font-semibold text-gray-300">← Voltar ao Painel</Link>}/>

  <Section title="Clientes e operação" subtitle="Situação atual dos cadastros, projetos e transações.">
   <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
    <Metric label="Clientes" value={counts.clients} href="/admin/clientes"/>
    <Metric label="Projetos cadastrados" value={counts.projects} href="/admin/projetos"/>
    <Metric label="Projetos em andamento" value={counts.activeProjects} href="/admin/projetos"/>
    <Metric label="Projetos concluídos" value={counts.completedProjects} href="/admin/projetos"/>
    <Metric label="Pedidos" value={counts.orders} href="/admin/pedidos"/>
    <Metric label="Orçamentos" value={counts.quotes} href="/admin/orcamentos"/>
    <Metric label="Orçamentos aceitos" value={counts.acceptedQuotes} href="/admin/orcamentos"/>
    <Metric label="Pagamentos pendentes" value={counts.pendingPayments} href="/admin/pagamentos" detail="Arquivados são desconsiderados."/>
   </div>
  </Section>

  <Section title="Academia e biblioteca" subtitle="Conteúdos e acessos cadastrados, sem somar reproduções inexistentes.">
   <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
    <Metric label="Cursos e conteúdos formativos" value={counts.courses} href="/admin/academia?section=courses"/>
    <Metric label="Cursos publicados" value={counts.publishedCourses} href="/admin/academia?section=courses"/>
    <Metric label="Aulas cadastradas" value={counts.lessons} href="/admin/academia?section=courses"/>
    <Metric label="Matrículas em cursos" value={counts.enrollments} href="/admin/academia/alunos" detail="Matrículas, não alunos únicos."/>
    <Metric label="E-books" value={counts.books} href="/admin/academia?section=library"/>
    <Metric label="Audiobooks" value={counts.audiobooks} href="/admin/academia?section=library"/>
    <Metric label="Mídias publicadas" value={counts.publishedMedia} href="/admin/academia?section=library"/>
    <Metric label="Liberações ativas" value={counts.activeGrants} href="/admin/academia?section=library" detail="Autorizações, não leitores únicos."/>
   </div>
  </Section>

  <Section title="Audiência pública" subtitle="Visualizações públicas registradas pela plataforma (até uma por IP, conteúdo e dia); não representam visitantes únicos de todo o período.">
   <div className="flex flex-wrap items-center gap-2" aria-label="Período das visualizações">
    {([7,30,90] as const).map(days=><button type="button" key={days} aria-pressed={period===days} onClick={()=>setPeriod(days)}
     className={'min-h-10 rounded-lg px-4 text-xs font-semibold '+(period===days?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-300')}>{days} dias</button>)}
   </div>
   {viewsError&&<p role="status" className="rounded-xl border border-amber-500/20 p-3 text-xs text-amber-200">{viewsError}</p>}
   <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
    <Metric label={'Visualizações · '+period+' dias'} value={viewsLoading?null:views?.total_views??null} detail="Eventos públicos registrados."/>
    <Metric label="Visualizações hoje" value={viewsLoading?null:views?.today_views??null} detail="Dia local de Brasília."/>
    <Metric label="Conteúdos com visitas" value={viewsLoading?null:top.length||0} detail="Até 20 conteúdos mais acessados."/>
   </div>
   {views&&<div className="grid gap-3 lg:grid-cols-2">
    <div className="rounded-xl border border-white/[.08] bg-[#161719] p-4">
     <h3 className="mb-4 text-sm font-semibold">Visualizações por dia</h3>
     <div className="flex h-36 items-end gap-1 overflow-hidden" role="img" aria-label={'Gráfico de visualizações dos últimos '+days.length+' dias'}>
      {days.map(d=><div key={d.date} title={formatDate(d.date)+': '+nf(Number(d.total)||0)} className="min-w-0 flex-1 rounded-t bg-[#A65A2A]/80" style={{height:Math.max(2,Math.round((Number(d.total)||0)/maxDaily*100))+'%'}}/>)}
     </div>
     <p className="mt-2 text-[11px] text-gray-500">Últimos {days.length} dias · passe sobre a barra para ver a contagem.</p>
    </div>
    <div className="rounded-xl border border-white/[.08] bg-[#161719] p-4">
     <h3 className="mb-4 text-sm font-semibold">Onde estão as visitas</h3>
     {countedViews.length? <div className="space-y-3">{countedViews.map(r=><div key={r.content_type} className="space-y-1">
      <div className="flex justify-between gap-2 text-xs"><span className="text-gray-300">{typeLabels[r.content_type]||r.content_type}</span><strong>{nf(Number(r.total)||0)}</strong></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#DFA269]" style={{width:(views.total_views?Math.min(100,Number(r.total)/views.total_views*100):0)+'%'}}/></div>
     </div>)}</div>:<p className="text-xs text-gray-500">Nenhuma visualização registrada neste período.</p>}
    </div>
   </div>}
   {views&&<div className="rounded-xl border border-white/[.08] bg-[#161719] p-4">
    <h3 className="mb-3 text-sm font-semibold">Conteúdos mais visualizados</h3>
    {top.length?<div className="divide-y divide-white/[.06]">{top.slice(0,10).map((r,i)=><div key={r.content_type+':'+r.content_key} className="flex items-center justify-between gap-3 py-2.5">
     <div className="min-w-0"><span className="mr-2 text-[11px] text-gray-500">{i+1}.</span>
      {r.path?.startsWith('/')&&!r.path.startsWith('//')?<Link to={r.path} className="break-words text-xs text-gray-200 hover:text-[#DFA269]">{r.label}</Link>:<span className="text-xs text-gray-200">{r.label}</span>}
      <span className="ml-2 text-[10px] text-gray-500">{typeLabels[r.content_type]||r.content_type}</span>
     </div><strong className="shrink-0 text-xs">{nf(Number(r.total)||0)}</strong>
    </div>)}</div>:<p className="text-xs text-gray-500">Sem visualizações registradas.</p>}
   </div>}
  </Section>

  <Section title="Consumo de conteúdo" subtitle="Estes números exigem eventos próprios de uso; visualizações de páginas não são reproduções nem downloads.">
   <div className="grid grid-cols-2 gap-3">
    <div className="rounded-xl border border-dashed border-white/15 p-4"><p className="text-xs text-gray-400">Ouvintes de audiobooks</p><strong className="mt-3 block text-lg text-gray-200">Não medido</strong><p className="mt-1 text-[11px] text-gray-500">Ainda não há registro auditável de reprodução.</p></div>
    <div className="rounded-xl border border-dashed border-white/15 p-4"><p className="text-xs text-gray-400">Downloads de arquivos</p><strong className="mt-3 block text-lg text-gray-200">Não medido</strong><p className="mt-1 text-[11px] text-gray-500">Abertura no leitor privado não equivale a download.</p></div>
   </div>
  </Section>
  {loading&&<p role="status" className="text-xs text-gray-500">Carregando indicadores operacionais…</p>}
  {!loading&&Object.values(counts).some(n=>n===null)&&<p className="text-xs text-gray-500">O símbolo — indica dados indisponíveis ou acesso insuficiente; não significa zero.</p>}
 </div>
}
