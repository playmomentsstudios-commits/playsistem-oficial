import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import {useToast} from '../../contexts/ToastContext'

type InterestStage='novo'|'em_contato'|'convertido'|'perdido'
type Interest={
 id:string;work_id:string;requested_format:'ebook'|'audiobook'|'combo';
 contact_name:string;whatsapp_digits:string;contact_email:string|null;source:string;
 stage:InterestStage;internal_notes:string|null;created_at:string;
 utm_source:string|null;utm_campaign:string|null;
 work:{release_code:string;title:string}|null
}
const labels:Record<InterestStage,string>={novo:'Novo',em_contato:'Em contato',convertido:'Convertido',perdido:'Não convertido'}
const formatLabel={ebook:'E-book',audiobook:'Audiobook',combo:'Combo E-book + Audiobook'}
const field='min-h-10 rounded-xl border border-white/10 bg-[#111215] px-3 text-xs text-gray-100'
const whatsappUrl=(digits:string)=>{
 const normalized=digits.length===10||digits.length===11?'55'+digits:digits
 return 'https://wa.me/'+normalized
}
export function AdminAcademyInterests(){
 const toast=useToast()
 const [rows,setRows]=useState<Interest[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [busyId,setBusyId]=useState<string|null>(null)
 const [stage,setStage]=useState<'all'|InterestStage>('all')
 const [query,setQuery]=useState('')
 const [release,setRelease]=useState('all')
 async function load(){
  setLoading(true)
  try{
   const {data,error:failure}=await supabase.from('academy_work_interests')
    .select('id,work_id,requested_format,contact_name,whatsapp_digits,contact_email,source,stage,internal_notes,created_at,utm_source,utm_campaign,work:academy_library_works(release_code,title)')
    .order('created_at',{ascending:false}).limit(500)
   if(failure)throw failure
   setRows((data||[]) as unknown as Interest[])
   setError('')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os interesses.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const releases=useMemo(()=>Array.from(new Set(rows.map(x=>x.work?.release_code).filter(Boolean))) as string[],[rows])
 const shown=useMemo(()=>rows.filter(r=>
  (stage==='all'||r.stage===stage)&&(release==='all'||r.work?.release_code===release)&&
  [r.contact_name,r.work?.title,r.whatsapp_digits,r.requested_format].some(value=>String(value||'').toLowerCase().includes(query.trim().toLowerCase()))
 ),[rows,stage,query,release])
 async function update(item:Interest,changes:Partial<Pick<Interest,'stage'|'internal_notes'>>){
  try{
   setBusyId(item.id)
   const {error:failure}=await supabase.from('academy_work_interests')
     .update({...changes,updated_at:new Date().toISOString()}).eq('id',item.id)
   if(failure)throw failure
   setRows(current=>current.map(r=>r.id===item.id?{...r,...changes}:r))
   toast('Interesse atualizado.','success')
  }catch(e){toast(e instanceof Error?e.message:'Falha ao salvar o interesse.','error')}
  finally{setBusyId(null)}
 }
 return <div className="mx-auto max-w-7xl space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#A65A2A]">Academia Sagamente · Comercial</p>
    <h1 className="mt-1 text-2xl font-bold">Interesses nas obras</h1>
    <p className="mt-2 max-w-2xl text-xs leading-6 text-gray-400">Acompanhe quem solicitou informações sobre E-book, Audiobook ou Combo. O envio não cobra, não cria pedido e não libera acesso automaticamente.</p>
   </div>
   <Link to="/admin/academia" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-bold text-[#DFA269]">← Gestão de conteúdo</Link>
  </div>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(['novo','em_contato','convertido','perdido'] as const).map(key=>
   <div key={key} className="rounded-2xl border border-white/10 bg-[#161719] p-4">
    <p className="text-xs text-gray-400">{labels[key]}</p><p className="mt-2 text-2xl font-bold tabular-nums">{rows.filter(r=>r.stage===key).length}</p>
   </div>)}</div>
  <div className="grid gap-3 sm:grid-cols-3">
   <input type="search" className={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome, telefone ou obra..." aria-label="Buscar interessados"/>
   <select value={stage} onChange={e=>setStage(e.target.value as typeof stage)} className={field} aria-label="Filtrar situação"><option value="all">Todas as situações</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
   <select value={release} onChange={e=>setRelease(e.target.value)} className={field} aria-label="Filtrar release"><option value="all">Todas as obras</option>{releases.sort().map(x=><option key={x} value={x}>Release {x}</option>)}</select>
  </div>
  {loading&&<p role="status" className="py-10 text-center text-sm text-gray-400">Carregando oportunidades comerciais...</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-500/20 bg-red-900/10 p-4 text-sm text-red-300">{error} <button type="button" onClick={()=>void load()} className="ml-3 underline">Tentar novamente</button></p>}
  {!loading&&!error&&shown.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-400">Nenhum interesse encontrado. As solicitações feitas pelas landing pages aparecerão aqui.</div>}
  {!loading&&!error&&<div className="grid gap-3 lg:grid-cols-2">{shown.map(item=>
   <article key={item.id} className="rounded-2xl border border-white/10 bg-[#161719] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-[10px] font-semibold uppercase tracking-widest text-[#dba477]">Release {item.work?.release_code||'—'} · {formatLabel[item.requested_format]}</p>
      <h2 className="mt-2 text-lg font-bold">{item.contact_name}</h2>
      <p className="mt-1 line-clamp-2 text-xs text-gray-400">{item.work?.title||'Obra'}</p>
      <p className="mt-2 text-[11px] text-gray-500">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.utm_source||'Landing orgânica'}</p>
     </div>
     <select aria-label={'Situação do interesse de '+item.contact_name} className={field} value={item.stage} disabled={busyId===item.id} onChange={e=>void update(item,{stage:e.target.value as InterestStage})}>
      {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
     <a className="inline-flex min-h-10 items-center rounded-xl bg-[#2b734a] px-4 text-xs font-bold text-white" href={whatsappUrl(item.whatsapp_digits)} target="_blank" rel="noopener noreferrer">Conversar no WhatsApp ↗</a>
     {item.contact_email&&<a className="inline-flex min-h-10 items-center rounded-xl border border-white/15 px-4 text-xs font-semibold text-gray-300" href={'mailto:'+encodeURIComponent(item.contact_email)}>E-mail</a>}
    </div>
    <label className="mt-4 block text-xs font-medium text-gray-400">Anotações internas
     <textarea defaultValue={item.internal_notes||''} key={item.id+'-'+(item.internal_notes||'')} rows={2}
       maxLength={1000} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101114] p-3 text-xs leading-6 text-gray-100"
       placeholder="Valor negociado, próxima ação, observações..." onBlur={e=>{if((e.target.value||'')!==(item.internal_notes||''))void update(item,{internal_notes:e.target.value||null})}}/>
    </label>
   </article>)}</div>}
  <p className="text-[11px] leading-5 text-gray-500">A lista mostra os últimos 500 interesses. Marcar como convertido é uma classificação manual, não uma confirmação automática de pagamento ou liberação do conteúdo.</p>
 </div>
}
