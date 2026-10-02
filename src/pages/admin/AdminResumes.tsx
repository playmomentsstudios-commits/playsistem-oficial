import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi, type Resume } from '../../services/siteContent'
import { SiteAssetImage } from '../../components/SiteAssetImage'
import { supabase } from '../../lib/supabase'

const typeLabel:Record<Resume['resume_type'],string>={
  mini:'Minicurrículo',
  complete:'Currículo completo',
  portfolio:'Currículo + portfólio',
  custom:'Personalizado',
}

const statusLabel:Record<Resume['status'],string>={
  draft:'Rascunho',
  published:'Publicado',
  archived:'Arquivado',
}

export function AdminResumes(){
  const toast=useToast()
  const [rows,setRows]=useState<Resume[]>([])
  const [loading,setLoading]=useState(true)
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState<'all'|Resume['status']>('all')
  const [type,setType]=useState<'all'|Resume['resume_type']>('all')
  const [busy,setBusy]=useState<string|null>(null)
  const [viewCounts,setViewCounts]=useState<Record<string,number>|null>(null)

  async function load(){
    try{
      setLoading(true)
      const [resumeRows,viewResult]=await Promise.all([
        siteContentApi.resumes(true),
        supabase.rpc('public_view_summary',{p_days:90}),
      ])
      setRows(resumeRows)

      if(viewResult.error){
        setViewCounts(null)
      }else{
        const items=Array.isArray((viewResult.data as any)?.top_items)?(viewResult.data as any).top_items:[]
        const counts:Record<string,number>={}
        for(const item of items){
          if(item?.content_type==='resume'&&item?.content_key){
            counts[String(item.content_key)]=Number(item.total||0)
          }
        }
        setViewCounts(counts)
      }
    }catch(error:any){
      toast(error.message||'Não foi possível carregar os currículos.','error')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    return rows.filter(row=>{
      if(status!=='all'&&row.status!==status)return false
      if(type!=='all'&&row.resume_type!==type)return false
      if(!term)return true
      return [
        row.internal_title,row.display_name,row.headline,row.slug,row.contact_email,row.location,
      ].some(value=>String(value||'').toLowerCase().includes(term))
    })
  },[rows,query,status,type])

  async function duplicate(row:Resume){
    try{
      setBusy(row.id)
      const copy=await siteContentApi.duplicateResume(row.id)
      await load()
      toast('Cópia criada como rascunho.','success')
      window.location.href='/admin/curriculos/'+copy.id
    }catch(error:any){
      toast(error.message||'Não foi possível duplicar.','error')
    }finally{
      setBusy(null)
    }
  }

  async function remove(row:Resume){
    if(!window.confirm('Excluir este currículo? Essa ação não pode ser desfeita.'))return
    try{
      setBusy(row.id)
      await siteContentApi.deleteResume(row.id)
      await load()
      toast('Currículo excluído.','success')
    }catch(error:any){
      toast(error.message||'Não foi possível excluir.','error')
    }finally{
      setBusy(null)
    }
  }

  async function copyPublicLink(row:Resume){
    const link=window.location.origin+'/curriculos/'+row.slug
    try{
      await navigator.clipboard.writeText(link)
      toast('Link público copiado.','success')
    }catch{
      window.prompt('Copie o link do currículo:',link)
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[.22em] text-[#ff6674] font-bold">Identidade profissional</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Currículos</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">Gerencie suas versões de currículo sem deixar o formulário aberto o tempo todo. Abra uma versão para editar ou crie uma nova quando precisar.</p>
      </div>
      <Link to="/admin/curriculos/novo" className="inline-flex min-h-11 px-4 items-center justify-center rounded-xl bg-[#E30613] hover:bg-[#b30010] text-white text-sm font-semibold transition-colors">+ Adicionar currículo</Link>
    </div>

    <section className="pm-surface p-4 md:p-5">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_180px_210px] gap-3">
        <label className="relative">
          <span className="sr-only">Pesquisar currículo</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar por título, nome, área ou contato..." className="w-full min-h-11 pl-10 pr-3 rounded-xl bg-black/40 border border-white/10 outline-none focus:border-[#E30613]/50 text-sm"/>
          <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">⌕</span>
        </label>
        <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="min-h-11 px-3 rounded-xl bg-black/40 border border-white/10 text-sm outline-none">
          <option value="all">Todos os status</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
          <option value="archived">Arquivados</option>
        </select>
        <select value={type} onChange={e=>setType(e.target.value as typeof type)} className="min-h-11 px-3 rounded-xl bg-black/40 border border-white/10 text-sm outline-none">
          <option value="all">Todos os tipos</option>
          <option value="mini">Minicurrículos</option>
          <option value="complete">Currículos completos</option>
          <option value="portfolio">Com portfólio</option>
          <option value="custom">Personalizados</option>
        </select>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[.07] text-xs text-gray-600">
        <span>{filtered.length} de {rows.length} currículo(s)</span>
        {(query||status!=='all'||type!=='all')&&<button onClick={()=>{setQuery('');setStatus('all');setType('all')}} className="text-gray-400 hover:text-white">Limpar filtros</button>}
      </div>
    </section>

    {loading&&<div className="pm-surface p-8 text-sm text-gray-500">Carregando currículos...</div>}

    {!loading&&filtered.length>0&&<div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-4">
      {filtered.map(row=>{
        const initials=(row.display_name||row.internal_title||'CV').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()
        return <article key={row.id} className="group rounded-2xl bg-[#141416] border border-white/10 overflow-hidden hover:border-white/20 transition-colors">
          <div className="p-4 flex gap-4">
            <div className="w-20 h-24 rounded-xl overflow-hidden bg-black/40 shrink-0 flex items-center justify-center">
              {(row.photo_url||row.photo_drive_file_id)?<SiteAssetImage driveFileId={row.photo_drive_file_id} url={row.photo_url} alt="" className="w-full h-full object-cover" fallback={<span className="text-xl font-black text-gray-700">{initials}</span>}/>:<span className="text-xl font-black text-gray-700">{initials}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">{row.internal_title||row.display_name||'Currículo sem título'}</h2>
                  {row.headline&&<p className="text-xs text-gray-500 mt-1 line-clamp-2">{row.headline}</p>}
                </div>
                <span className={'text-[10px] px-2 py-1 rounded-full shrink-0 '+(row.status==='published'?'bg-emerald-500/10 text-emerald-300':row.status==='archived'?'bg-white/[.06] text-gray-500':'bg-amber-500/10 text-amber-300')}>{statusLabel[row.status]}</span>
              </div>
              <p className="text-[11px] text-gray-600 mt-3 truncate">/curriculos/{row.slug}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/[.05] text-gray-500">{typeLabel[row.resume_type]}</span>
                {row.location&&<span className="text-[10px] px-2 py-1 rounded-full bg-white/[.05] text-gray-500">{row.location}</span>}
                {row.status==='published'&&<span className="text-[10px] px-2 py-1 rounded-full bg-[#E30613]/10 text-[#ff6b77]">👁 {viewCounts===null?'—':(viewCounts[row.slug]||0)} · 90 dias</span>}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-white/[.07] flex flex-wrap items-center gap-3">
            <Link to={'/admin/curriculos/'+row.id} className="text-xs font-semibold text-white hover:text-[#ff6977]">Editar</Link>
            {row.status==='published'&&<a href={'/curriculos/'+row.slug} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-white">Abrir ↗</a>}
            {row.status==='published'&&<button onClick={()=>void copyPublicLink(row)} className="text-xs text-gray-400 hover:text-white">Copiar link</button>}
            <button disabled={busy===row.id} onClick={()=>void duplicate(row)} className="text-xs text-gray-400 hover:text-white disabled:opacity-40">Duplicar</button>
            <button disabled={busy===row.id} onClick={()=>void remove(row)} className="ml-auto text-xs text-red-400 hover:text-red-300 disabled:opacity-40">Excluir</button>
          </div>
        </article>
      })}
    </div>}

    {!loading&&!filtered.length&&<div className="pm-surface p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[.04] border border-white/10 flex items-center justify-center text-2xl text-gray-700">CV</div>
      <h2 className="font-semibold mt-4">{rows.length?'Nenhum currículo encontrado':'Nenhum currículo criado'}</h2>
      <p className="text-sm text-gray-600 mt-2">{rows.length?'Tente alterar os filtros de pesquisa.':'Crie uma versão curta para uma seleção ou um currículo completo para outras oportunidades.'}</p>
      {!rows.length&&<Link to="/admin/curriculos/novo" className="inline-flex mt-5 min-h-11 px-4 items-center rounded-xl bg-[#E30613] text-white text-sm font-semibold">Adicionar primeiro currículo</Link>}
    </div>}
  </div>
}
