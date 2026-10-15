import {useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react'
import {useSearchParams} from 'react-router-dom'
import {academyLibraryAdminApi as api,librarySlugify,type AdminLibraryItem,type LibraryFormat,type LibraryUser,type LibraryGrant} from '../../api/academyLibraryAdmin'
import {siteContentApi,type SiteLandingPage} from '../../services/siteContent'
import {useToast} from '../../contexts/ToastContext'

type Editor={
 id?:string;format:LibraryFormat;title:string;slug:string;release_code:string;
 description:string;author_name:string;status:AdminLibraryItem['status'];
 drive_file_id:string;source_filename:string;cover_url:string;
 cover_drive_file_id:string;banner_url:string;sample_text:string;sample_audio_url:string;
}
const EMPTY=(format:LibraryFormat):Editor=>({
 format,title:'',slug:'',release_code:'',description:'',author_name:'',status:'draft',
 drive_file_id:'',source_filename:'',cover_url:'',cover_drive_file_id:'',
 banner_url:'',sample_text:'',sample_audio_url:'',
})
const FMT:{[key in LibraryFormat]:string}={ebook:'E-book',audiobook:'Audiobook'}
const field='w-full min-h-11 rounded-xl border border-white/10 bg-[#0d0d0f] px-3 text-sm text-gray-100 outline-none focus:border-[#A65A2A]'
const plain='min-h-10 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/[.06]'
const input=(label:string,body:ReactNode,hint?:string)=>
 <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-300">{label}</span>{body}{hint&&<span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}</label>
const labelOf=(u:LibraryUser)=>[u.first_name,u.last_name].filter(Boolean).join(' ')+' · '+u.email

export function AdminAcademyLibrary(){
 const toast=useToast()
 const [params,setParams]=useSearchParams()
 const [items,setItems]=useState<AdminLibraryItem[]>([])
 const [landings,setLandings]=useState<SiteLandingPage[]>([])
 const [users,setUsers]=useState<LibraryUser[]>([])
 const [grants,setGrants]=useState<LibraryGrant[]>([])
 const [current,setCurrent]=useState<Editor|null>(null)
 const [currentItem,setCurrentItem]=useState<AdminLibraryItem|null>(null)
 const [selectedUser,setSelectedUser]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [progress,setProgress]=useState<number|null>(null)
 const [filter,setFilter]=useState<'all'|LibraryFormat>('all')
 const [search,setSearch]=useState('')
 const [group,setGroup]=useState('new')
 const [error,setError]=useState('')
 const works=useMemo(()=>[...new Map(items.map(x=>[x.release_code,{code:x.release_code,title:x.title}])).values()], [items])
 const shown=useMemo(()=>items.filter(x=>(filter==='all'||x.format===filter)&&
  [x.title,x.author_name,x.release_code,x.slug].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[items,filter,search])
 const landingFor=(item:AdminLibraryItem)=>{
  const linked=landings.find(l=>l.id===item.landing_page_id)
  if(linked)return linked
  // Legacy SAGA NEGRA releases already have individually authored landings.
  // Find them for editing without changing their existing publication metadata.
  if(!/^\d{2}$/.test(item.release_code))return undefined
  return landings.find(l=>l.slug.startsWith('saga-negra')&&
    l.title.toLocaleLowerCase('pt-BR').includes('release '+item.release_code))
 }
 async function load(){
  setLoading(true)
  try{
    const [rows,pages]=await Promise.all([api.list(),siteContentApi.landingPages(true)])
    setItems(rows);setLandings(pages)
    setError('')
  }catch(e:any){setError(e.message||'Não foi possível carregar a biblioteca.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const begin=(format:LibraryFormat)=>{
  setCurrent(EMPTY(format));setCurrentItem(null);setGroup('new');setProgress(null)
 }
 const open=(item:AdminLibraryItem)=>{
  setCurrentItem(item);setGroup(item.release_code)
  setCurrent({
   id:item.id,format:item.format,title:item.title,slug:item.slug,release_code:item.release_code,
   description:item.description||'',author_name:item.author_name||'',status:item.status,
   drive_file_id:item.drive_file_id,source_filename:item.source_filename,
   cover_url:item.cover_url||'',cover_drive_file_id:item.cover_drive_file_id||'',
   banner_url:item.banner_url||'',sample_text:item.sample_text||'',
   sample_audio_url:item.sample_audio_url||''
  });setProgress(null)
 }
 // Product catalog deep links reuse the existing editor; no second file or grant is created.
 useEffect(()=>{
  if(loading||error)return
  const itemId=params.get('item')
  const requestedFormat=params.get('create')
  if(!itemId&&requestedFormat!=='ebook'&&requestedFormat!=='audiobook')return
  if(itemId){
   const item=items.find(row=>row.id===itemId)
   if(item)open(item)
   else toast('A obra solicitada não está mais disponível na biblioteca.','warning')
  }else if(requestedFormat==='ebook'||requestedFormat==='audiobook'){
   begin(requestedFormat)
  }
  setParams(previous=>{
   const next=new URLSearchParams(previous)
   next.delete('item')
   next.delete('create')
   return next
  },{replace:true})
 },[loading,error,items,params,setParams])

 const update=(patch:Partial<Editor>)=>setCurrent(v=>v?{...v,...patch}:v)
 const release=()=>current?.id?current.release_code:group==='new'
  ?'obra-'+librarySlugify(current?.title||''):group
 async function uploadSource(file:File){
  if(!current)return
  const collection=release()
  if(!collection||collection==='obra-'){
   toast('Informe o título ou selecione uma obra existente antes do upload.','error');return
  }
  try{
   setBusy(true);setProgress(0)
   const result=await api.uploadOriginal(file,collection,current.format,n=>setProgress(n))
   update({drive_file_id:result.id,source_filename:result.name,release_code:collection})
   toast('Arquivo original enviado para a pasta privada no Drive.','success')
  }catch(e:any){toast(e.message||'Erro ao enviar o arquivo.','error')}
  finally{setBusy(false);setProgress(null)}
 }
 async function uploadImage(file:File,kind:'cover'|'banner'){
  if(!current)return
  if(!file.type.startsWith('image/'))return toast('Escolha uma imagem de capa ou banner.','error')
  try{
   setBusy(true)
   const image=await siteContentApi.uploadSiteAsset(file,'LANDINGS',n=>setProgress(n))
   if(kind==='cover')update({cover_url:image.url,cover_drive_file_id:image.driveFileId})
   else update({banner_url:image.url})
   toast('Imagem enviada ao Drive.','success')
  }catch(e:any){toast(e.message||'Não foi possível enviar a imagem.','error')}
  finally{setBusy(false);setProgress(null)}
 }
 async function save(event:FormEvent){
  event.preventDefault()
  if(!current)return
  const releaseCode=release()
  if(!releaseCode||releaseCode==='obra-')return toast('Informe o título da obra.','error')
  if(!current.drive_file_id||!current.source_filename)return toast('Envie o PDF ou MP3 antes de salvar.','error')
  if(!current.id&&items.some(x=>x.release_code===releaseCode&&x.format===current.format)){
   return toast('Essa obra já possui esse formato. Abra o conteúdo existente para editar.','error')
  }
  try{
   setBusy(true)
   const saved=await api.save({...current,release_code:releaseCode,slug:current.slug.trim()||librarySlugify(current.title),mime_type:current.format==='ebook'?'application/pdf':'audio/mpeg'})
   toast(saved.landing_page_id?'Conteúdo salvo com landing vinculada.':'Conteúdo salvo.','success')
   setCurrent(null);setCurrentItem(null);await load()
  }catch(e:any){toast(e.message||'Não foi possível salvar o conteúdo.','error')}
  finally{setBusy(false)}
 }
 async function changeStatus(item:AdminLibraryItem,value:AdminLibraryItem['status']){
  if(value==='published'&&!confirm('Publicar este conteúdo e a landing vinculada? O arquivo completo continuará protegido para usuários sem liberação.'))return
  try{
   setBusy(true)
   await api.setStatus(item,value);await load()
   toast(value==='published'?'Conteúdo e landing publicados.':'Status atualizado.','success')
  }catch(e:any){toast(e.message||'Não foi possível alterar o status.','error')}
  finally{setBusy(false)}
 }
 async function manage(item:AdminLibraryItem){
  setCurrentItem(item);setCurrent(null);setSelectedUser('')
  try{
   setBusy(true)
   const [us,gs]=await Promise.all([api.users(),api.grants(item.id)])
   setUsers(us);setGrants(gs)
  }catch(e:any){toast(e.message||'Falha ao carregar as liberações.','error')}
  finally{setBusy(false)}
 }
 async function setGrant(userId:string,active:boolean){
  if(!currentItem)return
  try{
   setBusy(true);await api.grant(currentItem.id,userId,active)
   setGrants(await api.grants(currentItem.id))
   toast(active?'Acesso liberado ao cliente.':'Acesso revogado.','success')
   setSelectedUser('')
  }catch(e:any){toast(e.message||'Não foi possível atualizar o acesso.','error')}
  finally{setBusy(false)}
 }
 return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#A65A2A]">Academia · Conteúdo digital</p>
    <h2 className="mt-1 text-xl font-bold">Biblioteca · E-books e audiobooks</h2>
    <p className="mt-1 text-xs text-gray-500">Uma obra pode ter dois formatos; cada formato possui arquivo privado, liberação e página própria.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" className={plain} onClick={()=>begin('ebook')}>＋ E-book</button>
    <button type="button" className={plain} onClick={()=>begin('audiobook')}>＋ Audiobook</button>
   </div>
  </div>
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
    placeholder="Buscar títulos, autores ou obras..." aria-label="Buscar conteúdos da biblioteca"
    className={field+' sm:max-w-md'}/>
   <div className="flex gap-2" aria-label="Filtrar biblioteca">
    {([['all','Todos'],['ebook','E-books'],['audiobook','Audiobooks']] as const).map(([key,label])=>
     <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}
       className={'min-h-10 rounded-xl px-3 text-xs font-semibold '+(filter===key?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-400')}>{label}</button>)}
   </div>
  </div>
  {error&&<p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">{error}<button onClick={()=>void load()} className="ml-3 underline">Tentar novamente</button></p>}
  {loading?<p role="status" className="py-8 text-center text-xs text-gray-500">Carregando biblioteca...</p>:
   shown.length===0?<section className="rounded-2xl border border-dashed border-white/10 p-9 text-center text-sm text-gray-500">Nenhum conteúdo encontrado. Use + E-book ou + Audiobook para começar.</section>:
   <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map(item=>{
    const land=landingFor(item)
    return <article key={item.id} className="min-w-0 rounded-2xl border border-white/[.08] bg-[#141416] p-4">
     <div className="flex gap-3">
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/[.04]">{item.cover_url?<img src={item.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-xl text-[#b47f57]">{item.format==='ebook'?'▤':'♫'}</div>}</div>
      <div className="min-w-0 flex-1"><span className="text-[10px] font-semibold uppercase tracking-widest text-[#DFA269]">{FMT[item.format]}</span>
       <h3 className="mt-1 line-clamp-2 text-sm font-bold">{item.title}</h3>
       <p className="mt-1 text-[10px] text-gray-500">Obra: {item.release_code} · {item.status==='published'?'Publicado':item.status==='archived'?'Arquivado':item.status==='private_beta'?'Beta privado':'Rascunho'}</p>
      </div>
     </div>
     <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className={plain} onClick={()=>open(item)}>Editar</button>
      <button type="button" className={plain} onClick={()=>void manage(item)}>Liberar clientes</button>
      {land&&<a target="_blank" rel="noopener noreferrer" className={plain} href={'/admin/landings/preview/'+encodeURIComponent(land.slug)}>Prévia</a>}
      {land&&<a className={plain} href={'/admin/landings?edit='+encodeURIComponent(land.id)}>Editar landing</a>}
     </div>
     <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[.07] pt-3">
      <span className="text-[11px] text-gray-500">{land?(item.landing_page_id?'Página gerada':'Página existente')+' · '+(land.status==='published'?'pública':'rascunho'):'Sem landing vinculada'}</span>
      <select aria-label={'Alterar status de '+item.title} disabled={busy} value={item.status}
       className="rounded-lg border border-white/10 bg-[#0d0d0f] px-2 py-2 text-[11px]"
       onChange={e=>void changeStatus(item,e.target.value as AdminLibraryItem['status'])}>
       <option value="draft">Rascunho</option><option value="private_beta">Beta privado</option>
       <option value="published">Publicado</option><option value="archived">Arquivado</option>
      </select>
     </div>
    </article>})}</div>}
  {current&&<div role="dialog" aria-modal="true" aria-label={'Editar '+FMT[current.format]} className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-3 sm:p-6">
   <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-6">
    <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#DFA269]">{FMT[current.format]}</p><h3 className="mt-1 text-lg font-bold">{current.id?'Editar conteúdo':'Adicionar '+FMT[current.format].toLowerCase()}</h3></div>
     <button type="button" className={plain} onClick={()=>setCurrent(null)}>Fechar</button>
    </div>
    <form className="space-y-4" onSubmit={e=>void save(e)}>
     {!current.id&&input('Obra / coleção',
      <select className={field} value={group} onChange={e=>{
       setGroup(e.target.value);update({drive_file_id:'',source_filename:'',release_code:e.target.value==='new'?'':e.target.value})
      }}>
       <option value="new">Criar nova obra</option>
       {works.map(w=><option key={w.code} value={w.code}>Juntar à obra: {w.title}</option>)}
      </select>,'Os formatos da mesma obra aparecem juntos na biblioteca.')}
     {input('Título *',<input className={field} required value={current.title} onChange={e=>{
       update({title:e.target.value,slug:current.id?current.slug:librarySlugify(e.target.value),
        ...(!current.id&&group==='new'?{drive_file_id:'',source_filename:''}:{})})
     }}/>)}
     <div className="grid gap-3 sm:grid-cols-2">
      {input('Autor / narrador',<input className={field} value={current.author_name} onChange={e=>update({author_name:e.target.value})}/>)}
      {input('Slug *',<input className={field} required value={current.slug} onChange={e=>update({slug:e.target.value})} disabled={!!current.id}/>)}
     </div>
     {input('Descrição de apresentação',<textarea rows={3} className={field+' py-3'} value={current.description} onChange={e=>update({description:e.target.value})} placeholder="O que o aluno encontrará nesta obra?"/>)}
     {input('Arquivo original privado *',
      <input type="file" accept={current.format==='ebook'?'.pdf,application/pdf':'.mp3,audio/mpeg'} disabled={busy} className={field+' py-2'} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void uploadSource(file)}}/>,
      current.format==='ebook'?'Arquivo PDF: somente usuários com acesso verão o leitor.':'Arquivo MP3: o player e as legendas continuam na biblioteca privada.')}
     {current.source_filename&&<p className="text-[11px] text-emerald-300">✓ No Drive privado: {current.source_filename}</p>}
     {progress!==null&&<p role="status" className="text-xs text-[#DFA269]">Enviando ao Drive: {progress}%</p>}
     <div className="grid gap-4 sm:grid-cols-2">
      {input('Capa da obra',<input type="file" accept="image/*" disabled={busy} className={field+' py-2'} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void uploadImage(file,'cover')}}/>,'Use imagem vertical e legível no celular.')}
      {input('Banner da landing',<input type="file" accept="image/*" disabled={busy} className={field+' py-2'} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void uploadImage(file,'banner')}}/>,'Imagem horizontal para apresentar o novo conteúdo.')}
     </div>
     {(current.cover_url||current.banner_url)&&<div className="grid grid-cols-2 gap-3">{current.cover_url&&<img src={current.cover_url} alt="Capa enviada" className="h-32 w-full rounded-xl object-cover"/>}{current.banner_url&&<img src={current.banner_url} alt="Banner enviado" className="h-32 w-full rounded-xl object-cover"/>}</div>}
     {current.format==='ebook'?input('Trecho gratuito para a landing',<textarea rows={5} className={field+' py-3'} value={current.sample_text} onChange={e=>update({sample_text:e.target.value})} placeholder="Um parágrafo de prévia sem revelar o conteúdo completo."/>):
      input('URL de amostra pública do áudio (opcional)',<input className={field} type="url" value={current.sample_audio_url} onChange={e=>update({sample_audio_url:e.target.value})} placeholder="https://.../amostra.mp3"/>,
       'Use apenas um trecho público. Nunca cole o link privado do arquivo completo do Drive.')}
     <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
      <p className="max-w-sm text-[11px] leading-5 text-gray-500">A landing é criada em rascunho junto com o novo conteúdo. Revise e personalize antes de publicar.</p>
      <button disabled={busy||!current.title.trim()||!current.drive_file_id} className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-xs font-bold text-white disabled:opacity-50" type="submit">{busy?'Salvando...':'Salvar conteúdo'}</button>
     </div>
    </form>
   </div>
  </div>}
  {currentItem&&!current&&<div role="dialog" aria-modal="true" aria-label="Acesso manual dos clientes" className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-3 sm:p-6">
   <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[#141416] p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">Liberação manual</h3><p className="mt-1 text-xs text-gray-400">{currentItem.title} · {FMT[currentItem.format]}</p></div>
     <button className={plain} onClick={()=>setCurrentItem(null)}>Fechar</button>
    </div>
    <label className="block text-xs text-gray-400">Cliente cadastrado
     <select className={field+' mt-2'} value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}>
      <option value="">Escolha um cliente</option>{users.map(user=><option key={user.id} value={user.id}>{labelOf(user)}</option>)}
     </select>
    </label>
    <button type="button" disabled={!selectedUser||busy} className="min-h-11 rounded-xl bg-[#A65A2A] px-4 text-xs font-bold text-white disabled:opacity-50"
     onClick={()=>void setGrant(selectedUser,true)}>Liberar acesso</button>
    <p className="text-xs text-gray-500">A concessão é por formato. A pessoa só verá o conteúdo após a publicação ou no beta privado.</p>
    <div className="max-h-80 space-y-2 overflow-y-auto">
     {grants.length===0?<p className="py-3 text-xs text-gray-500">Ainda não há clientes com liberações para este conteúdo.</p>:
     grants.map(grant=>{
      const user=users.find(u=>u.id===grant.user_id)
      return <div key={grant.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] p-3">
       <div className="min-w-0"><p className="truncate text-xs font-semibold">{user?labelOf(user):grant.user_id}</p><p className={'text-[11px] '+(grant.active?'text-emerald-300':'text-gray-500')}>{grant.active?'Acesso ativo':'Acesso revogado'}</p></div>
       <button type="button" disabled={busy} className={plain} onClick={()=>void setGrant(grant.user_id,!grant.active)}>
        {grant.active?'Revogar':'Reativar'}
       </button>
      </div>})}
    </div>
   </div>
  </div>}
 </div>
}
