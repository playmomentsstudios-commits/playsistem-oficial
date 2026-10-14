import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { academyLibraryApi,type LibraryItem } from '../../api/academyLibrary'

type OwnedRelease={release_code:string;title:string;ebook?:LibraryItem;audiobook?:LibraryItem}

export function LibraryOwnedSection(){
 const [items,setItems]=useState<LibraryItem[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  academyLibraryApi.mine()
   .then(data=>{if(active)setItems(data)})
   .catch((e:any)=>{if(active)setError(e?.message||'Falha ao carregar sua biblioteca')})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])
 const releases=useMemo(()=>{
  const grouped=new Map<string,OwnedRelease>()
  for(const item of items){
   const found=grouped.get(item.release_code)||{release_code:item.release_code,title:item.title}
   found[item.format]=item
   grouped.set(item.release_code,found)
  }
  return Array.from(grouped.values()).sort((a,b)=>a.release_code.localeCompare(b.release_code))
 },[items])
 if(!loading&&!error&&releases.length===0)return null
 return <section aria-labelledby="saga-negra-library-heading" className="mb-6 rounded-2xl border border-[#A65A2A]/25 bg-[#171719] p-4 sm:p-5">
  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
   <div>
    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#E0A16A]">Sua biblioteca pessoal</p>
    <h2 id="saga-negra-library-heading" className="mt-1 text-lg font-bold text-white">SAGA NEGRA — E-books e audiobooks</h2>
    <p className="mt-1 text-xs text-gray-400">Conteúdos liberados para sua conta. Os testes não geram cobrança.</p>
   </div>
   {!loading&&<span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300">{releases.length} título(s) · {items.length} formato(s)</span>}
  </div>
  {error&&<div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
  {loading&&<p role="status" className="text-xs text-gray-400">Carregando livros e áudios…</p>}
  {!loading&&!error&&<div className="grid gap-2 sm:grid-cols-2">
   {releases.map(release=><div key={release.release_code} className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
    <div>
     <span className="text-[10px] font-bold uppercase tracking-widest text-[#E4AD7D]">Release {release.release_code}</span>
     <h3 className="mt-1 text-sm font-semibold leading-snug text-white">{release.title}</h3>
    </div>
    <div className="flex flex-wrap gap-2">
     {release.ebook&&<Link to={'/app/academia/biblioteca/'+release.ebook.id} className="inline-flex min-h-10 items-center rounded-lg border border-white/15 bg-white/[.04] px-3 text-xs font-semibold text-gray-100 hover:border-[#DFA269]">Ler e-book →</Link>}
     {release.audiobook&&<Link to={'/app/academia/biblioteca/'+release.audiobook.id} className="inline-flex min-h-10 items-center rounded-lg border border-[#A65A2A]/50 bg-[#A65A2A]/20 px-3 text-xs font-semibold text-[#F5B77B] hover:bg-[#A65A2A]/30">Ouvir audiobook →</Link>}
    </div>
   </div>)}
  </div>}
 </section>
}
