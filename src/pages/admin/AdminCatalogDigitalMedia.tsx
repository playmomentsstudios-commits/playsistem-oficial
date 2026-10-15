import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {academyLibraryAdminApi,type AdminLibraryItem,type LibraryFormat} from '../../api/academyLibraryAdmin'

type FormatFilter='all'|LibraryFormat
const formatLabel:Record<LibraryFormat,string>={ebook:'E-book',audiobook:'Audiobook'}
const statusLabel:Record<AdminLibraryItem['status'],string>={
 draft:'Rascunho',private_beta:'Beta privado',published:'Publicado',archived:'Arquivado',
}

export function AdminCatalogDigitalMedia(){
 const [items,setItems]=useState<AdminLibraryItem[]>([])
 const [filter,setFilter]=useState<FormatFilter>('all')
 const [search,setSearch]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 async function load(){
  setLoading(true);setError('')
  try{setItems(await academyLibraryAdminApi.list())}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar a biblioteca.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])

 const filtered=useMemo(()=>{
  const q=search.toLocaleLowerCase('pt-BR').trim()
  return items.filter(item=>(filter==='all'||item.format===filter)&&(!q||[
   item.title,item.author_name,item.slug,item.release_code,
  ].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(q))))
 },[items,filter,search])

 return <div className="mx-auto max-w-7xl space-y-5">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#DFA269]">Catálogo · Produtos digitais</p>
    <h1 className="mt-1 text-2xl font-bold text-gray-100">E-books e audiobooks</h1>
    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-400">
     Consulte os formatos digitais cadastrados na Academia. Capa, arquivo original e liberação são administrados em um único lugar.
    </p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Link to="/admin/academia?section=library&create=ebook" className="inline-flex min-h-10 items-center rounded-xl border border-[#DFA269]/30 px-3 text-xs font-semibold text-[#E8AF7B]">＋ E-book</Link>
    <Link to="/admin/academia?section=library&create=audiobook" className="inline-flex min-h-10 items-center rounded-xl bg-[#A65A2A] px-3 text-xs font-semibold text-white">＋ Audiobook</Link>
   </div>
  </header>

  <div className="rounded-xl border border-[#DFA269]/20 bg-[#A65A2A]/[.06] p-3 text-xs leading-relaxed text-gray-300">
   <strong className="text-[#E8AF7B]">Produtos digitais:</strong> a organização dos e-books e audiobooks aparece aqui sem duplicar os arquivos da Academia.
   Este catálogo administrativo não publica ofertas de venda nem libera conteúdo automaticamente após um pagamento.
  </div>

  <div className="flex flex-wrap gap-2">
   <Link to="/admin/produtos" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-300">← Todos os produtos</Link>
   <Link to="/admin/academia?section=library" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-300">Gerenciar biblioteca ↗</Link>
  </div>

  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   <input type="search" aria-label="Buscar produtos digitais" placeholder="Buscar título, autor ou obra..." value={search}
    onChange={e=>setSearch(e.target.value)}
    className="min-h-11 w-full rounded-xl border border-white/10 bg-[#141416] px-4 text-sm text-gray-100 outline-none focus:border-[#DFA269] sm:max-w-md"/>
   <div aria-label="Filtrar formato" className="flex gap-2">
    {([['all','Todos'],['ebook','E-books'],['audiobook','Audiobooks']] as const).map(([value,label])=>
     <button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}
      className={'min-h-10 rounded-xl px-3 text-xs font-semibold '+(filter===value?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-300')}>{label}</button>
    )}
   </div>
  </div>

  {error&&<div role="alert" className="rounded-xl border border-red-500/20 p-4 text-sm text-red-200">
   {error} <button type="button" className="ml-2 underline" onClick={()=>void load()}>Tentar novamente</button>
  </div>}
  {loading?<div role="status" className="rounded-xl border border-white/10 p-6 text-sm text-gray-400">Carregando produtos digitais...</div>
   :!error&&filtered.length===0?<div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-400">
    Nenhuma obra encontrada. Use os botões acima para cadastrar um e-book ou audiobook na Academia.
   </div>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {filtered.map(item=><article key={item.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/[.08] bg-[#141416] p-4">
     <div className="flex min-w-0 gap-3">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white/[.04]">
       {item.cover_url?<img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-cover"/>:
        <span aria-hidden="true" className="grid h-full place-items-center text-2xl text-[#DFA269]">{item.format==='ebook'?'▤':'♫'}</span>}
      </div>
      <div className="min-w-0 flex-1">
       <p className="text-[10px] font-bold uppercase tracking-widest text-[#DFA269]">{formatLabel[item.format]}</p>
       <h2 className="mt-1 text-sm font-semibold leading-snug text-gray-100">{item.title}</h2>
       {item.author_name&&<p className="mt-1 text-xs text-gray-400">{item.author_name}</p>}
       <p className="mt-2 text-[11px] text-gray-500">Obra: {item.release_code} · {statusLabel[item.status]}</p>
      </div>
     </div>
     <div className="mt-auto flex flex-wrap gap-2 border-t border-white/[.07] pt-3">
      <Link to={'/admin/academia?section=library&item='+encodeURIComponent(item.id)}
       className="inline-flex min-h-10 items-center rounded-lg bg-[#A65A2A] px-3 text-xs font-semibold text-white">Editar na Academia ↗</Link>
      <Link to="/admin/academia?section=library" className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-gray-300">Biblioteca</Link>
     </div>
    </article>)}
   </div>}
 </div>
}
