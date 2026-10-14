import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { academyDigitalApi,type DigitalPublication,type DigitalAsset,type DigitalKind } from '../../api/academyDigital'

type FormState={id?:string;title:string;slug:string;kind:DigitalKind;summary:string;author:string;status:'draft'|'published'|'archived';cover_url:string;duration_minutes:string;page_count:string;drive_file_id:string;file_name:string}
const empty:FormState={title:'',slug:'',kind:'ebook',summary:'',author:'',status:'draft',cover_url:'',duration_minutes:'',page_count:'',drive_file_id:'',file_name:''}
const slugify=(s:string)=>s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export function AdminAcademyDigital(){
 const [rows,setRows]=useState<DigitalPublication[]>([])
 const [form,setForm]=useState<FormState>(empty)
 const [open,setOpen]=useState(false)
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const load=()=>academyDigitalApi.adminList().then(setRows).catch(e=>setError(e.message||'Falha ao carregar publicações.')).finally(()=>setLoading(false))
 useEffect(()=>{void load()},[])
 function start(){setForm(empty);setError('');setSuccess('');setOpen(true)}
 async function edit(row:DigitalPublication){
  setError('');setSuccess('')
  try{
   const asset=await academyDigitalApi.adminAsset(row.id)
   setForm({id:row.id,title:row.title,slug:row.slug,kind:row.kind,summary:row.summary||'',author:row.author||'',status:row.status,cover_url:row.cover_url||'',duration_minutes:row.duration_minutes?.toString()||'',page_count:row.page_count?.toString()||'',drive_file_id:asset?.drive_file_id||'',file_name:asset?.file_name||''})
   setOpen(true)
  }catch(e:any){setError(e.message||'Falha ao abrir publicação.')}
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setSuccess('')
  try{
   const title=form.title.trim();const slug=slugify(form.slug||title);const driveId=form.drive_file_id.trim()
   if(!title||!slug)throw new Error('Título e endereço são obrigatórios.')
   if(form.status==='published'&&!driveId)throw new Error('Para publicar é obrigatório vincular o arquivo privado do Drive.')
   if(driveId&&!/^[a-zA-Z0-9_-]{8,255}$/.test(driveId))throw new Error('Identificador de arquivo do Drive inválido.')
   const publication=await academyDigitalApi.savePublication({id:form.id,title,slug,kind:form.kind,status:form.status,summary:form.summary,author:form.author,cover_url:form.cover_url,duration_minutes:form.kind==='audiobook'&&form.duration_minutes?Number(form.duration_minutes):null,page_count:form.kind==='ebook'&&form.page_count?Number(form.page_count):null})
   if(driveId)await academyDigitalApi.saveAsset(publication.id,driveId,form.kind==='ebook'?'application/pdf':'audio/mpeg',form.file_name)
   setSuccess('Publicação salva. Confira o acesso autorizado antes de divulgá-la.')
   setOpen(false);await load()
  }catch(e:any){setError(e.message||'Não foi possível salvar a publicação.')}finally{setBusy(false)}
 }
 const input="min-h-11 w-full rounded-xl border border-white/10 bg-[#111113] px-3 text-sm text-gray-200 outline-none focus:border-[#DFA269]"
 return <div className="mx-auto max-w-6xl">
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
   <div><Link to="/admin/academia" className="text-xs text-[#DFA269] hover:underline">← Gestão da Academia</Link><h1 className="mt-1 text-2xl font-bold text-white">Publicações digitais</h1><p className="mt-1 text-sm text-gray-400">E-books e audiobooks. Arquivos privados, com acesso por compra ou liberação autorizada.</p></div>
   <button onClick={start} type="button" className="min-h-11 rounded-xl bg-[#A65A2A] px-4 text-xs font-bold text-white">+ Nova publicação</button>
  </div>
  <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-4 text-xs leading-relaxed text-amber-100">Não use links públicos do Drive para obras pagas. Nesta versão, associe o ID de um arquivo PDF ou MP3 privado, guardado na conta institucional autorizada; o teste real do acesso é obrigatório antes da publicação comercial. A vinculação de produtos e combos ao checkout será realizada na etapa de integração de pagamentos.</div>
  {error&&<div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
  {success&&<div role="status" className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div>}
  {loading?<p className="text-sm text-gray-400">Carregando publicações…</p>:rows.length===0?<p className="rounded-2xl border border-dashed border-white/15 p-9 text-center text-sm text-gray-400">Nenhuma publicação cadastrada. Crie a primeira como rascunho.</p>:<div className="overflow-hidden rounded-2xl border border-white/10">
   {rows.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#17181C] p-4 last:border-none">
    <div className="min-w-0"><span className="text-[10px] uppercase tracking-wide text-[#DFA269]">{row.kind==='ebook'?'E-book':'Audiobook'} · {row.status==='published'?'Publicado':row.status==='draft'?'Rascunho':'Arquivado'}</span><h2 className="mt-1 truncate font-semibold text-white">{row.title}</h2><p className="text-xs text-gray-500">{row.slug}</p></div>
    <div className="flex gap-2">{row.id&&<Link to={'/app/academia/obra/'+row.id} className="min-h-10 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300">Testar leitor</Link>}<button type="button" onClick={()=>void edit(row)} className="min-h-10 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white">Editar</button></div>
   </div>)}
  </div>}
  {open&&<div className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/80 p-2 sm:items-center sm:p-5"><form onSubmit={e=>void save(e)} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#18191C] p-5">
   <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{form.id?'Editar publicação':'Nova publicação'}</h2><button type="button" onClick={()=>setOpen(false)} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Fechar</button></div>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs text-gray-400 sm:col-span-2">Título<input required maxLength={180} className={input+' mt-1'} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value,slug:f.id?f.slug:slugify(e.target.value)}))}/></label>
    <label className="text-xs text-gray-400">Slug<input required className={input+' mt-1'} value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))}/></label>
    <label className="text-xs text-gray-400">Formato<select className={input+' mt-1'} value={form.kind} onChange={e=>setForm(f=>({...f,kind:e.target.value as DigitalKind}))}><option value="ebook">E-book PDF</option><option value="audiobook">Audiobook MP3</option></select></label>
    <label className="text-xs text-gray-400">Autor<input className={input+' mt-1'} value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))}/></label>
    <label className="text-xs text-gray-400">Situação<select className={input+' mt-1'} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as FormState['status']}))}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
    <label className="text-xs text-gray-400 sm:col-span-2">Descrição<textarea rows={3} className={input+' mt-1 py-3'} value={form.summary} onChange={e=>setForm(f=>({...f,summary:e.target.value}))}/></label>
    <label className="text-xs text-gray-400 sm:col-span-2">URL pública da imagem de capa (não do PDF/MP3)<input type="url" className={input+' mt-1'} value={form.cover_url} onChange={e=>setForm(f=>({...f,cover_url:e.target.value}))}/></label>
    <label className="text-xs text-gray-400">{form.kind==='audiobook'?'Duração em minutos':'Páginas'}<input type="number" min="1" className={input+' mt-1'} value={form.kind==='audiobook'?form.duration_minutes:form.page_count} onChange={e=>setForm(f=>({...f,[form.kind==='audiobook'?'duration_minutes':'page_count']:e.target.value}))}/></label>
    <label className="text-xs text-gray-400">ID do arquivo privado no Drive<input className={input+' mt-1'} placeholder="Identificador, nunca link público" value={form.drive_file_id} onChange={e=>setForm(f=>({...f,drive_file_id:e.target.value}))}/></label>
    <label className="text-xs text-gray-400 sm:col-span-2">Nome do arquivo (opcional)<input className={input+' mt-1'} value={form.file_name} onChange={e=>setForm(f=>({...f,file_name:e.target.value}))}/></label>
   </div>
   <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setOpen(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-xs">Cancelar</button><button disabled={busy} className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-xs font-bold text-white disabled:opacity-50">{busy?'Salvando…':'Salvar publicação'}</button></div>
  </form></div>}
 </div>
}
