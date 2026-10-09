import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'

type SeoPage={
 path:string;title:string;description:string;primary_keyword:string;secondary_keywords:string[];
 og_image_url:string|null;canonical_url:string|null;noindex:boolean;published:boolean;updated_at:string
}
type Keyword={id:string;phrase:string;page_path:string|null;intent:string;priority:string;notes:string}
const empty:SeoPage={path:'/',title:'',description:'',primary_keyword:'',secondary_keywords:[],og_image_url:null,canonical_url:null,noindex:false,published:false,updated_at:''}
function quality(row:SeoPage){
 const findings:string[]=[]
 if(row.title.length<30||row.title.length>65)findings.push('Título: revisar comprimento (30–65 caracteres)')
 if(row.description.length<105||row.description.length>165)findings.push('Descrição: revisar comprimento (105–165 caracteres)')
 if(!row.primary_keyword.trim())findings.push('Definir palavra-chave principal')
 if(row.noindex)findings.push('Não indexável por configuração')
 if(!row.published)findings.push('Rascunho — não enviado ao público')
 return findings
}
const pageHost=()=>typeof window==='undefined'?'':window.location.origin
const intentLabels:Record<string,string>={transactional:'Pronto para contratar',commercial:'Comparando serviços',informational:'Buscando informação',navigational:'Buscando marca'}
const priorityOrder:Record<string,number>={high:0,medium:1,low:2}

export function AdminSeo(){
 const toast=useToast()
 const [pages,setPages]=useState<SeoPage[]>([])
 const [keywords,setKeywords]=useState<Keyword[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [selected,setSelected]=useState<string>('/')
 const [draft,setDraft]=useState<SeoPage>(empty)
 const [newKeyword,setNewKeyword]=useState('')
 const [filter,setFilter]=useState('')
 const [intent,setIntent]=useState('commercial')
 const [priority,setPriority]=useState('medium')
 const [keywordFilter,setKeywordFilter]=useState('')
 const [focusOnlyHigh,setFocusOnlyHigh]=useState(false)
 const [updatingKeyword,setUpdatingKeyword]=useState<string|null>(null)

 const load=async()=>{
  const [p,k]=await Promise.all([
   supabase.from('seo_pages').select('*').order('path'),
   supabase.from('seo_keywords').select('*').order('phrase'),
  ])
  if(p.error)throw p.error
  if(k.error)throw k.error
  const list=(p.data||[]) as SeoPage[]
  setPages(list)
  setKeywords((k.data||[]) as Keyword[])
  const item=list.find(row=>row.path===selected)||list[0]
  if(item){setSelected(item.path);setDraft({...item,secondary_keywords:[...(item.secondary_keywords||[])]})}
 }
 useEffect(()=>{
  let alive=true
  load().catch(e=>{if(alive)toast(e?.message||'Não foi possível carregar o SEO.','error')})
   .finally(()=>{if(alive)setLoading(false)})
  return ()=>{alive=false}
 },[])
 const issues=useMemo(()=>pages.flatMap(page=>quality(page).map(message=>({path:page.path,message}))),[pages])
 const countPublished=pages.filter(page=>page.published&&!page.noindex).length
 const duplicateTitles=useMemo(()=>pages.filter(p=>p.published&&pages.some(q=>q!==p&&q.published&&q.title.toLowerCase()===p.title.toLowerCase())).map(p=>p.path),[pages])

 function edit(path:string){
  const row=pages.find(p=>p.path===path)
  if(!row)return
  setSelected(path)
  setDraft({...row,secondary_keywords:[...(row.secondary_keywords||[])]})
 }
 async function save(){
  if(!draft.title.trim()||!draft.description.trim())return toast('Preencha título e descrição.','error')
  if(draft.title.trim().length<10||draft.title.trim().length>100)return toast('O título deve ter entre 10 e 100 caracteres.','error')
  if(draft.description.trim().length<40||draft.description.trim().length>320)return toast('A descrição deve ter entre 40 e 320 caracteres.','error')
  if(draft.canonical_url&&!/^https:\/\/[^\s]+$/.test(draft.canonical_url))return toast('A URL canônica deve usar HTTPS.','error')
  setSaving(true)
  try{
   const {data:{user}}=await supabase.auth.getUser()
   const {error}=await supabase.from('seo_pages').update({
    title:draft.title.trim(),description:draft.description.trim(),primary_keyword:draft.primary_keyword.trim(),
    secondary_keywords:draft.secondary_keywords,og_image_url:draft.og_image_url?.trim()||null,
    canonical_url:draft.canonical_url?.trim()||null,noindex:draft.noindex,published:draft.published,
    updated_at:new Date().toISOString(),updated_by:user?.id||null,
   }).eq('path',draft.path)
   if(error)throw error
   await load()
   toast('SEO salvo! As novas metatags serão servidas pelo Cloudflare.','success')
  }catch(e:any){toast(e?.message||'Falha ao salvar metadados.','error')}
  finally{setSaving(false)}
 }
 async function addKeyword(){
  const phrase=newKeyword.trim()
  if(phrase.length<3)return toast('Digite uma palavra-chave válida.','error')
  setSaving(true)
  try{
   const {error}=await supabase.from('seo_keywords').insert({phrase,page_path:selected,intent,priority,notes:'Hipótese editorial; volume não medido'})
   if(error)throw error
   setNewKeyword('')
   await load()
   toast('Palavra-chave adicionada.','success')
  }catch(e:any){toast(e?.message||'Não foi possível adicionar palavra-chave.','error')}
  finally{setSaving(false)}
 }
 async function deleteKeyword(id:string){
  if(!window.confirm('Excluir esta palavra-chave do planejamento SEO?'))return
  try{
   const {error}=await supabase.from('seo_keywords').delete().eq('id',id)
   if(error)throw error
   await load()
  }catch(e:any){toast(e?.message||'Não foi possível excluir.','error')}
 }
 async function updateKeyword(id:string,patch:Partial<Pick<Keyword,'intent'|'priority'>>){
  setUpdatingKeyword(id)
  try{
   const {data,error}=await supabase.from('seo_keywords').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).select('id').single()
   if(error)throw error
   if(!data)throw new Error('O banco não confirmou a alteração.')
   setKeywords(current=>current.map(k=>k.id===id?{...k,...patch}:k))
   toast('Palavra-chave atualizada.','success')
  }catch(e:any){toast(e?.message||'Não foi possível atualizar a palavra-chave.','error')}
  finally{setUpdatingKeyword(null)}
 }
 const rowKeywords=keywords.filter(k=>k.page_path===selected)
 const displayedKeywords=rowKeywords.filter(k=>
  (!keywordFilter.trim()||(k.phrase+' '+(k.notes||'')).toLowerCase().includes(keywordFilter.trim().toLowerCase()))
  &&(!focusOnlyHigh||k.priority==='high')
 ).sort((a,b)=>(priorityOrder[a.priority]??9)-(priorityOrder[b.priority]??9)||a.phrase.localeCompare(b.phrase,'pt-BR'))
 const highIntent=keywords.filter(k=>k.priority==='high'&&(k.intent==='transactional'||k.intent==='commercial')).length

 if(loading)return <div className="p-6 text-sm text-gray-400">Carregando Central de SEO...</div>
 return <div className="max-w-7xl space-y-6 pb-10">
  <div>
   <p className="text-xs uppercase tracking-[.16em] text-[#DFA269] font-semibold">Gestão do site · SEO</p>
   <h1 className="text-2xl font-bold mt-2 text-white">Central de SEO</h1>
   <p className="text-sm text-gray-400 mt-2">Metadados editáveis, mapa de páginas, palavras-chave e auditoria inicial. Sem inventar tráfego ou posições.</p>
  </div>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   {[
    {value:pages.length,label:'Páginas catalogadas'},
    {value:countPublished,label:'Páginas indexáveis'},
    {value:keywords.length,label:'Termos planejados'},
    {value:issues.length+duplicateTitles.length,label:'Itens para revisar'},
   ].map(box=><div key={box.label} className="bg-[#151518] border border-white/10 rounded-2xl p-4">
    <p className="text-xl font-bold text-white">{box.value}</p><p className="text-xs text-gray-400 mt-1">{box.label}</p>
   </div>)}
  </div>
  <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
   <section className="bg-[#151518] border border-white/10 rounded-2xl p-4">
    <h2 className="font-semibold text-white mb-3">Páginas públicas</h2>
    <input value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Pesquisar página" placeholder="Buscar página ou palavra-chave..." className="w-full min-h-10 bg-black border border-white/10 rounded-lg px-3 text-sm mb-3"/>
    <div className="space-y-1 max-h-[490px] overflow-y-auto">
     {pages.filter(row=>(row.path+' '+row.title+' '+row.primary_keyword).toLowerCase().includes(filter.toLowerCase())).map(row=>
      <button key={row.path} type="button" onClick={()=>edit(row.path)} className={'w-full text-left p-3 rounded-xl border transition-colors '+(selected===row.path?'bg-[#A65A2A]/15 border-[#A65A2A]/50':'bg-white/[.02] border-transparent hover:border-white/15')}>
       <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white">{row.path}</span>
        <span className={'text-[10px] '+(!row.published||row.noindex?'text-amber-300':'text-emerald-300')}>{!row.published?'Rascunho':row.noindex?'Noindex':'Indexável'}</span>
       </div>
       <p className="text-xs text-gray-400 mt-1 line-clamp-2">{row.title}</p>
      </button>)}
    </div>
   </section>
   <section className="bg-[#151518] border border-white/10 rounded-2xl p-4 sm:p-5">
    <div className="flex flex-wrap justify-between gap-2 mb-4">
     <div><h2 className="font-semibold text-white">Editar metadados</h2><p className="text-xs text-[#DFA269] mt-1">{selected}</p></div>
     <a href={pageHost()+selected} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg px-3 min-h-9 text-xs border border-white/10 text-gray-300">Visualizar página ↗</a>
    </div>
    <div className="space-y-4">
     <label className="block text-xs text-gray-300">Título SEO (title)
      <input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} maxLength={100} className="mt-1 w-full rounded-xl bg-black border border-white/10 px-3 min-h-11 text-sm text-white"/>
      <span className="block text-gray-500 mt-1">{draft.title.length} caracteres · recomendado 30 a 65</span>
     </label>
     <label className="block text-xs text-gray-300">Meta Description
      <textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} rows={3} maxLength={320} className="mt-1 w-full rounded-xl bg-black border border-white/10 px-3 py-3 text-sm text-white"/>
      <span className="block text-gray-500 mt-1">{draft.description.length} caracteres · referência 105 a 165</span>
     </label>
     <div className="grid sm:grid-cols-2 gap-3">
      <label className="block text-xs text-gray-300">Palavra-chave principal
       <input value={draft.primary_keyword} onChange={e=>setDraft({...draft,primary_keyword:e.target.value})} className="mt-1 w-full rounded-lg bg-black border border-white/10 min-h-10 px-3 text-sm"/>
      </label>
      <label className="block text-xs text-gray-300">Imagem para compartilhamento (URL HTTPS)
       <input value={draft.og_image_url||''} onChange={e=>setDraft({...draft,og_image_url:e.target.value})} placeholder="Opcional" className="mt-1 w-full rounded-lg bg-black border border-white/10 min-h-10 px-3 text-sm"/>
      </label>
     </div>
     <label className="block text-xs text-gray-300">Canonical manual (HTTPS; deixe vazio para URL atual)
      <input value={draft.canonical_url||''} onChange={e=>setDraft({...draft,canonical_url:e.target.value})} placeholder={pageHost()+draft.path} className="mt-1 w-full rounded-lg bg-black border border-white/10 min-h-10 px-3 text-sm"/>
     </label>
     <div className="flex gap-5 flex-wrap">
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.published} onChange={e=>setDraft({...draft,published:e.target.checked})}/> Metadados publicados</label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.noindex} onChange={e=>setDraft({...draft,noindex:e.target.checked})}/> Bloquear indexação (noindex)</label>
     </div>
     <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] text-gray-500 mb-2">Prévia aproximada de pesquisa</p>
      <p className="text-sm text-[#82AFFF] font-semibold truncate">{draft.title||'Título da página'}</p>
      <p className="text-[11px] text-emerald-400 truncate mt-1">{draft.canonical_url||pageHost()+draft.path}</p>
      <p className="text-xs text-gray-300 mt-1 line-clamp-2">{draft.description||'Descrição da página'}</p>
     </div>
     {quality(draft).length>0&&<div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-200">{quality(draft).join(' · ')}</div>}
     <button onClick={()=>void save()} disabled={saving} className="min-h-11 px-5 rounded-xl bg-[#A65A2A] text-white text-sm font-semibold disabled:opacity-50">{saving?'Salvando...':'Salvar SEO da página'}</button>
    </div>
   </section>
  </div>
  <div className="grid lg:grid-cols-2 gap-4">
   <section className="rounded-2xl bg-[#151518] border border-white/10 p-5">
    <h2 className="font-semibold text-white">Palavras-chave da página selecionada</h2>
    <p className="text-xs text-gray-500 mt-1">Prioridade comercial estimada, não volume ou ranking medido.</p>
    <p className="text-xs text-[#DFA269] mt-2">{rowKeywords.length} termos · {rowKeywords.filter(k=>k.priority==='high').length} prioridade alta</p>
    <div className="flex gap-3 flex-wrap items-center mt-4">
     <input type="search" aria-label="Pesquisar palavras-chave" placeholder="Pesquisar palavra..." value={keywordFilter} onChange={e=>setKeywordFilter(e.target.value)} className="flex-1 min-w-40 min-h-11 bg-black border border-white/10 rounded-lg px-3 text-xs"/>
     <label className="inline-flex items-center gap-2 text-xs text-gray-300 min-h-11"><input type="checkbox" checked={focusOnlyHigh} onChange={e=>setFocusOnlyHigh(e.target.checked)}/>Alta prioridade</label>
    </div>
    <div className="space-y-2 mt-3 max-h-[420px] overflow-y-auto">
     {displayedKeywords.length?displayedKeywords.map(k=><div key={k.id} className="rounded-xl border border-white/10 p-3 bg-white/[.015]">
      <div className="flex items-start justify-between gap-2">
       <div className="min-w-0"><p className="text-sm font-semibold text-gray-100 break-words">{k.phrase}</p><p className="text-[10px] text-gray-500 mt-1">{intentLabels[k.intent]||k.intent}</p></div>
       <button type="button" aria-label={'Excluir '+k.phrase} disabled={updatingKeyword!==null} onClick={()=>void deleteKeyword(k.id)} className="text-red-300 min-w-9 min-h-9 disabled:opacity-50">×</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
       <label className="text-[10px] text-gray-400">Intenção
        <select aria-label={'Intenção de '+k.phrase} value={k.intent} disabled={updatingKeyword!==null} onChange={e=>void updateKeyword(k.id,{intent:e.target.value})} className="mt-1 w-full min-h-10 bg-black border border-white/10 rounded-lg px-2 text-xs text-white disabled:opacity-50">
         <option value="transactional">Contratação</option><option value="commercial">Comparação</option><option value="informational">Informação</option><option value="navigational">Marca</option>
        </select>
       </label>
       <label className="text-[10px] text-gray-400">Prioridade
        <select aria-label={'Prioridade de '+k.phrase} value={k.priority} disabled={updatingKeyword!==null} onChange={e=>void updateKeyword(k.id,{priority:e.target.value})} className="mt-1 w-full min-h-10 bg-black border border-white/10 rounded-lg px-2 text-xs text-white disabled:opacity-50">
         <option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option>
        </select>
       </label>
      </div>
     </div>):<p className="text-xs text-gray-500 p-3">Nenhuma palavra-chave encontrada neste filtro.</p>}
    </div>
    <div className="grid sm:grid-cols-2 gap-2 mt-4">
     <input value={newKeyword} onChange={e=>setNewKeyword(e.target.value)} placeholder="Nova palavra-chave" className="bg-black border border-white/10 rounded-lg px-3 min-h-10 text-sm sm:col-span-2"/>
     <select aria-label="Intenção" value={intent} onChange={e=>setIntent(e.target.value)} className="min-h-10 bg-black border border-white/10 rounded-lg px-3 text-xs"><option value="commercial">Comercial</option><option value="informational">Informativa</option><option value="navigational">Navegação</option><option value="transactional">Transacional</option></select>
     <select aria-label="Prioridade" value={priority} onChange={e=>setPriority(e.target.value)} className="min-h-10 bg-black border border-white/10 rounded-lg px-3 text-xs"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select>
     <button type="button" disabled={saving} onClick={()=>void addKeyword()} className="min-h-10 px-4 bg-white/10 border border-white/15 rounded-lg text-xs">+ Adicionar palavra-chave</button>
    </div>
   </section>
   <section className="rounded-2xl bg-[#151518] border border-white/10 p-5">
    <h2 className="font-semibold text-white">Auditoria e conexões</h2>
     <p className="text-sm text-[#DFA269] mt-2">{highIntent} termos prioritários com intenção comercial ou de contratação.</p>
     <p className="text-xs text-gray-500 mt-1">A prioridade não equivale ao volume real no Google.</p>
    <div className="mt-4 space-y-3 text-sm">
     <div><span className="text-emerald-300">●</span> Metadados da Home e páginas públicas: configuração disponível</div>
     <div><span className="text-emerald-300">●</span> Sitemap: <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-[#DFA269] underline">Abrir /sitemap.xml</a></div>
     <div><span className="text-emerald-300">●</span> Robots: <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="text-[#DFA269] underline">Abrir /robots.txt</a></div>
     <div><span className="text-amber-300">●</span> Domínio próprio: conferir compra e ligação DNS antes de definir o canônico</div>
     <div><span className="text-amber-300">●</span> Google Search Console: verificação de propriedade e envio de sitemap pendentes</div>
     <div><span className="text-amber-300">●</span> GA4: vinculação e métricas reais pendentes</div>
    </div>
    <div className="flex flex-wrap gap-2 mt-5">
     <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="min-h-10 inline-flex items-center px-3 border border-white/10 rounded-lg text-xs">Google Search Console ↗</a>
     <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="min-h-10 inline-flex items-center px-3 border border-white/10 rounded-lg text-xs">Google Analytics ↗</a>
    </div>
    <h3 className="font-semibold mt-5 text-sm">Pontos de atenção editoriais</h3>
    <div className="max-h-48 overflow-y-auto mt-3 space-y-2 text-xs text-gray-400">
     {issues.slice(0,40).map((issue,i)=><p key={i}><span className="text-[#DFA269]">{issue.path}</span> · {issue.message}</p>)}
     {duplicateTitles.map(path=><p key={path}><span className="text-red-300">{path}</span> · Título duplicado</p>)}
     {issues.length===0&&duplicateTitles.length===0&&<p>Nenhum alerta editorial simples. Faça ainda testes de rastreamento e velocidade.</p>}
    </div>
    <p className="text-[11px] text-gray-500 mt-4">Não há conexão automática com as métricas do Google. Os indicadores reais só serão exibidos depois de conectar e validar a propriedade.</p>
   </section>
  </div>
 </div>
}
