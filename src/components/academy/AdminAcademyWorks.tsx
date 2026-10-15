import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {academyLibraryAdminApi as api,libraryAccessMessage,type AdminLibraryWork,type AdminLibraryItem,type LibraryFormat,type LibraryUser,type LibraryGrant} from '../../api/academyLibraryAdmin'
import {siteContentApi,type SiteLandingPage} from '../../services/siteContent'
import {useToast} from '../../contexts/ToastContext'
import {AdminAcademyLibrary} from './AdminAcademyLibrary'

const btn='inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/[.07] disabled:opacity-40'
const input='min-h-11 w-full rounded-xl border border-white/15 bg-[#101114] px-3 py-2 text-sm text-gray-100 outline-none focus:border-[#c47f4f]'
const formats:{[K in LibraryFormat]:string}={ebook:'E-book',audiobook:'Audiobook'}
const statusLabel:{[K in AdminLibraryItem['status']]:string}={draft:'Rascunho',private_beta:'Beta privado',published:'Publicado',archived:'Arquivado'}
type AccessScope='both'|LibraryFormat

export function AdminAcademyWorks(){
 const toast=useToast()
 const [params,setParams]=useSearchParams()
 const [editorMode,setEditorMode]=useState(Boolean(params.get('item')||params.get('create')))
 const [works,setWorks]=useState<AdminLibraryWork[]>([])
 const [items,setItems]=useState<AdminLibraryItem[]>([])
 const [landings,setLandings]=useState<SiteLandingPage[]>([])
 const [customers,setCustomers]=useState<LibraryUser[]>([])
 const [grants,setGrants]=useState<LibraryGrant[]>([])
 const [accessWork,setAccessWork]=useState<AdminLibraryWork|null>(null)
 const [editWork,setEditWork]=useState<AdminLibraryWork|null>(null)
 const [selectedCustomer,setSelectedCustomer]=useState('')
 const [accessScope,setAccessScope]=useState<AccessScope>('both')
 const [filter,setFilter]=useState<'all'|LibraryFormat>('all')
 const [query,setQuery]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{if(params.has('item')||params.has('create'))setEditorMode(true)},[params])
 async function load(){
  setLoading(true)
  try{
   const [books,rows,pages]=await Promise.all([api.works(),api.list(),siteContentApi.landingPages(true)])
   setWorks(books);setItems(rows);setLandings(pages);setError('')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar as obras.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const workItems=(w:AdminLibraryWork)=>items.filter(i=>i.work_id===w.id||i.release_code===w.release_code)
 const shown=useMemo(()=>works.filter(w=>{
  const rows=items.filter(i=>i.work_id===w.id||i.release_code===w.release_code)
  return (filter==='all'||rows.some(i=>i.format===filter))&&
   [w.title,w.release_code,w.description,...rows.map(i=>i.title)].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
 }),[works,items,filter,query])
 const landing=(w:AdminLibraryWork)=>landings.find(p=>p.id===w.landing_page_id)
 function editor(id?:string,format?:LibraryFormat,work?:AdminLibraryWork){
  setEditorMode(true);setAccessWork(null);setEditWork(null)
  setParams(previous=>{
   const next=new URLSearchParams(previous)
   next.set('section','library');next.delete('item');next.delete('create');next.delete('group')
   if(id)next.set('item',id)
   else if(format)next.set('create',format)
   if(work)next.set('group',work.release_code)
   return next
  })
 }
 function closeEditor(){
  setEditorMode(false);setParams(previous=>{
   const next=new URLSearchParams(previous);next.delete('item');next.delete('create');next.delete('group')
   return next
  },{replace:true})
  void load()
 }
 async function status(item:AdminLibraryItem,value:AdminLibraryItem['status']){
  if(value==='published'&&!window.confirm('Publicar este formato? O acesso integral continuará exigindo liberação individual.'))return
  try{setBusy(true);await api.setStatus(item,value);await load();toast('Status atualizado.','success')}
  catch(e){toast(e instanceof Error?e.message:'Erro ao mudar o status.','error')}
  finally{setBusy(false)}
 }
 async function manage(w:AdminLibraryWork){
  setAccessWork(w);setSelectedCustomer('');setAccessScope('both')
  try{
   setBusy(true)
   const [people,existing]=await Promise.all([api.users(),api.grantsForWork(workItems(w).map(i=>i.id))])
   setCustomers(people);setGrants(existing)
  }catch(e){toast(e instanceof Error?e.message:'Não foi possível consultar os acessos.','error')}
  finally{setBusy(false)}
 }
 const allowed=(w:AdminLibraryWork,scope:AccessScope)=>
  workItems(w).filter(i=>scope==='both'||i.format===scope).map(i=>i.id)
 async function assign(userId:string,active:boolean,scope:AccessScope){
  if(!accessWork)return
  const targets=allowed(accessWork,scope)
  if(!targets.length)return toast('A obra ainda não possui esse formato cadastrado.','error')
  try{
   setBusy(true)
   const result=await api.setWorkGrant(targets,userId,active)
   setGrants(await api.grantsForWork(workItems(accessWork).map(i=>i.id)))
   setSelectedCustomer('')
   toast(libraryAccessMessage(result,active),'success')
  }catch(e){toast(e instanceof Error?e.message:'Não foi possível atualizar o acesso.','error')}
  finally{setBusy(false)}
 }
 async function uploadArtwork(file:File,kind:'cover'|'banner'){
  if(!editWork)return
  if(!file.type.startsWith('image/'))return toast('Selecione uma imagem.','error')
  try{setBusy(true);const a=await siteContentApi.uploadSiteAsset(file,'LANDINGS')
   setEditWork(v=>v?{...v,[kind==='cover'?'cover_url':'banner_url']:a.url}:v)
   toast('Imagem enviada. Salve a obra para aplicar.','success')
  }catch(e){toast(e instanceof Error?e.message:'Erro no upload.','error')}
  finally{setBusy(false)}
 }
 async function saveWork(event:FormEvent){
  event.preventDefault()
  if(!editWork)return
  try{
   setBusy(true)
   await api.updateWork(editWork.id,editWork)
   toast('Dados e landing da obra atualizados.','success')
   setEditWork(null);await load()
  }catch(e){toast(e instanceof Error?e.message:'Não foi possível atualizar a obra.','error')}
  finally{setBusy(false)}
 }
 if(editorMode)return <div className="space-y-5">
  <button type="button" className={btn} onClick={closeEditor}>← Voltar às obras</button>
  <AdminAcademyLibrary/>
 </div>
 return <div className="space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-xl font-bold">Obras digitais</h2>
    <p className="mt-1 max-w-xl text-xs leading-6 text-gray-400">Uma obra, uma landing de apresentação e até dois formatos com acesso individual. Publicar não libera o arquivo completo automaticamente.</p>
   </div>
   <div className="flex gap-2">
    <button type="button" className={btn} onClick={()=>editor(undefined,'ebook')}>＋ E-book</button>
    <button type="button" className={btn} onClick={()=>editor(undefined,'audiobook')}>＋ Audiobook</button>
   </div>
  </header>
  <div className="flex flex-wrap gap-3">
   <input aria-label="Buscar obras" type="search" className={input+' flex-1 min-w-[180px]'} placeholder="Buscar obra, tema ou release..." value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label="Filtrar formato" className={input+' max-w-[170px]'} value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
    <option value="all">Todos</option><option value="ebook">E-books</option><option value="audiobook">Audiobooks</option>
   </select>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-500/20 p-3 text-xs text-red-300">{error} <button onClick={()=>void load()} className="underline">Recarregar</button></p>}
  {loading?<p role="status" className="py-10 text-center text-sm text-gray-400">Carregando obras...</p>:
   shown.length===0?<p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-400">Nenhuma obra encontrada. Cadastre o primeiro formato acima.</p>:
   <div className="grid gap-4 lg:grid-cols-2">{shown.map(w=>{
    const contents=workItems(w)
    const page=landing(w)
    return <article key={w.id} className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-5">
     <div className="flex items-start gap-4">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-[#252122]">{w.cover_url?<img src={w.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-3xl text-[#c47f4f]">▤</div>}</div>
      <div className="min-w-0 flex-1">
       <p className="text-[10px] font-bold uppercase tracking-widest text-[#d99b6c]">Obra · {w.release_code}</p>
       <h3 className="mt-1 text-base font-bold leading-snug">{w.title}</h3>
       <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-400">{w.description||'Descrição disponível na landing da obra.'}</p>
       <p className="mt-2 text-[11px] text-gray-500">{page?'Landing '+(page.status==='published'?'pública':page.status==='draft'?'em rascunho':'pausada'):'Aguardando vínculo com landing'}</p>
      </div>
     </div>
     <div className="mt-4 grid gap-2 sm:grid-cols-2">{(['ebook','audiobook'] as const).map(format=>{
      const item=contents.find(i=>i.format===format)
      return <div key={format} className="flex flex-col gap-2 rounded-xl border border-white/[.08] p-3">
       <div className="flex items-center justify-between gap-2"><strong className="text-xs">{formats[format]}</strong><span className="text-[10px] text-gray-500">{item?statusLabel[item.status]:'Não cadastrado'}</span></div>
       {item?<div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={()=>editor(item.id)}>Editar</button>
        <select aria-label={'Status de '+formats[format]+' da obra '+w.title} className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101114] px-2 text-[11px] text-gray-300" value={item.status} disabled={busy} onChange={e=>void status(item,e.target.value as AdminLibraryItem['status'])}>
         <option value="draft">Rascunho</option><option value="private_beta">Beta privado</option><option value="published">Publicado</option><option value="archived">Arquivado</option>
        </select>
       </div>:<button type="button" className={btn} onClick={()=>editor(undefined,format,w)}>＋ Adicionar formato</button>}
      </div>
     })}</div>
     <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[.08] pt-4">
      <button type="button" className={btn} onClick={()=>setEditWork({...w})}>Editar obra</button>
      <button type="button" className={btn} onClick={()=>void manage(w)}>Liberar clientes</button>
      {page&&<><Link className={btn} to={'/admin/landings?edit='+encodeURIComponent(page.id)}>Editar landing</Link>
       <a href={'/admin/landings/preview/'+encodeURIComponent(page.slug)} target="_blank" rel="noopener noreferrer" className={btn}>Prévia</a>
       {page.status==='published'&&<a href={'/l/'+encodeURIComponent(page.slug)} target="_blank" rel="noopener noreferrer" className={btn}>Ver página pública ↗</a>}</>}
     </div>
    </article>
   })}</div>}
  {editWork&&<div role="dialog" aria-modal="true" aria-label="Editar obra" className="fixed inset-0 z-[95] overflow-y-auto bg-black/80 p-3 sm:p-6">
   <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#141416] p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Editar obra · {editWork.release_code}</h3><button type="button" className={btn} onClick={()=>setEditWork(null)}>Fechar</button></div>
    <form className="mt-5 space-y-4" onSubmit={e=>void saveWork(e)}>
     <label className="block text-xs text-gray-300">Título da obra<input className={input+' mt-2'} value={editWork.title} required onChange={e=>setEditWork(v=>v?{...v,title:e.target.value}:v)}/></label>
     <label className="block text-xs text-gray-300">Apresentação<textarea rows={4} className={input+' mt-2'} value={editWork.description||''} onChange={e=>setEditWork(v=>v?{...v,description:e.target.value}:v)}/></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs text-gray-300">Capa da obra<input type="file" accept="image/*" className={input+' mt-2'} disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadArtwork(f,'cover')}}/></label>
      <label className="block text-xs text-gray-300">Banner da obra<input type="file" accept="image/*" className={input+' mt-2'} disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadArtwork(f,'banner')}}/></label>
     </div>
     <label className="block text-xs text-gray-300">Landing principal da obra
      <select className={input+' mt-2'} value={editWork.landing_page_id||''} onChange={e=>setEditWork(v=>v?{...v,landing_page_id:e.target.value||null}:v)}>
       <option value="">Sem landing vinculada</option>{landings.filter(p=>p.slug.startsWith('saga-negra')||p.slug.startsWith('biblioteca-')).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <span className="mt-1 block text-[11px] text-gray-500">A mesma landing apresenta o e-book e o audiobook. Endereços existentes são preservados.</span>
     </label>
     <button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-xs font-bold text-white disabled:opacity-40">{busy?'Salvando...':'Salvar obra'}</button>
    </form>
   </div>
  </div>}
  {accessWork&&<div role="dialog" aria-modal="true" aria-label="Gerenciar acesso aos formatos" className="fixed inset-0 z-[95] overflow-y-auto bg-black/80 p-3 sm:p-6">
   <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[#141416] p-5">
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold">Liberar clientes</h3><p className="mt-1 text-xs leading-5 text-gray-400">{accessWork.title}</p></div><button className={btn} onClick={()=>setAccessWork(null)}>Fechar</button></div>
    <label className="block text-xs text-gray-400">Cliente
     <select className={input+' mt-2'} value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)}><option value="">Selecione um cliente</option>{customers.map(u=><option key={u.id} value={u.id}>{[u.first_name,u.last_name].filter(Boolean).join(' ')} · {u.email}</option>)}</select>
    </label>
    <label className="block text-xs text-gray-400">O que deseja liberar?
     <select className={input+' mt-2'} value={accessScope} onChange={e=>setAccessScope(e.target.value as AccessScope)}>
      <option value="both">Pacote completo (ambos os formatos)</option>
      <option value="ebook">Somente e-book</option><option value="audiobook">Somente audiobook</option>
     </select>
    </label>
    <button type="button" disabled={busy||!selectedCustomer} className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-xs font-bold text-white disabled:opacity-40" onClick={()=>void assign(selectedCustomer,true,accessScope)}>Liberar acesso</button>
    <p className="text-[11px] leading-5 text-gray-500">A concessão é por formato. Pacote completo libera os dois registros existentes; revogar um formato não remove o outro. Publicar a landing não libera o conteúdo completo.</p>
    <h4 className="text-sm font-bold">Clientes com liberações</h4>
    <div className="max-h-80 space-y-2 overflow-y-auto">{customers.filter(u=>grants.some(g=>g.user_id===u.id)).map(u=>{
     const mine=grants.filter(g=>g.user_id===u.id&&g.active)
     return <div key={u.id} className="rounded-xl border border-white/[.08] p-3">
      <p className="truncate text-xs font-semibold">{[u.first_name,u.last_name].filter(Boolean).join(' ')} · {u.email}</p>
      <div className="mt-2 flex flex-wrap gap-2">{(['ebook','audiobook'] as const).map(format=>{
       const item=workItems(accessWork).find(i=>i.format===format)
       if(!item)return null
       const has=mine.some(g=>g.item_id===item.id)
       return <button type="button" key={format} disabled={busy} onClick={()=>void assign(u.id,!has,format)} className={btn}>{formats[format]} · {has?'Revogar':'Liberar'}</button>
      })}</div>
     </div>
    })}</div>
   </div>
  </div>}
 </div>
}
