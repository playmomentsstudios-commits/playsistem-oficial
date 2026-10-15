import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useAuth} from '../../contexts/AuthContext'
import {useToast} from '../../contexts/ToastContext'
import {
  DASHBOARD_SHORTCUTS,DASHBOARD_WIDGETS,DASHBOARD_METRICS,
  DEFAULT_DASHBOARD_LAYOUT,loadDashboardLayout,saveDashboardLayout,normalizeDashboardLayout,
  type DashboardLayout,
} from '../../lib/adminDashboardLayout'

type CatalogEntry={id:string;label:string;description?:string}
type LayoutField=keyof DashboardLayout

function OptionList({items,selected,onChange}:{
  items:readonly CatalogEntry[]
  selected:string[]
  onChange:(next:string[])=>void
}){
  const ordered=[
    ...selected.map(id=>items.find(item=>item.id===id)).filter((item):item is CatalogEntry=>Boolean(item)),
    ...items.filter(item=>!selected.includes(item.id)),
  ]
  function move(id:string,dir:-1|1){
    const i=selected.indexOf(id), j=i+dir
    if(i<0||j<0||j>=selected.length)return
    const next=[...selected];[next[i],next[j]]=[next[j],next[i]];onChange(next)
  }
  return <div className="space-y-2">
    {ordered.map(item=>{
      const checked=selected.includes(item.id),index=selected.indexOf(item.id)
      return <div key={item.id} className={'flex items-center gap-2 rounded-xl border p-3 '+(checked?'border-[#A65A2A]/35 bg-[#A65A2A]/[.06]':'border-white/[.07] bg-white/[.02]')}>
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#A65A2A]" checked={checked} onChange={e=>onChange(e.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>
          <span className="min-w-0"><span className="block text-sm font-medium text-gray-200">{item.label}</span>{item.description&&<span className="mt-0.5 block text-[11px] text-gray-500">{item.description}</span>}</span>
        </label>
        {checked&&<div className="flex shrink-0 gap-1">
          <button type="button" disabled={index===0} onClick={()=>move(item.id,-1)} aria-label={'Subir '+item.label} title="Subir" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300 disabled:opacity-25">↑</button>
          <button type="button" disabled={index===selected.length-1} onClick={()=>move(item.id,1)} aria-label={'Descer '+item.label} title="Descer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300 disabled:opacity-25">↓</button>
        </div>}
      </div>
    })}
  </div>
}

export function AdminDashboardPreferencesPanel(){
  const {user}=useAuth(),toast=useToast()
  const [draft,setDraft]=useState<DashboardLayout>(()=>normalizeDashboardLayout(DEFAULT_DASHBOARD_LAYOUT))
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [activeTab,setActiveTab]=useState<LayoutField>('shortcuts')

  useEffect(()=>{
    if(!user?.id)return
    let mounted=true
    setLoading(true)
    loadDashboardLayout().then(value=>{if(mounted)setDraft(value)})
      .catch(error=>{if(mounted)toast(error.message||'Não foi possível carregar a personalização do painel.','error')})
      .finally(()=>{if(mounted)setLoading(false)})
    return()=>{mounted=false}
  },[user?.id])

  function change(field:LayoutField,next:string[]){
    setDraft(current=>({...current,[field]:next}))
  }
  async function save(){
    setBusy(true)
    try{
      const saved=await saveDashboardLayout(draft)
      setDraft(saved)
      toast('Seu painel foi personalizado e salvo na conta.','success')
    }catch(error:any){toast(error.message||'Não foi possível salvar o painel.','error')}
    finally{setBusy(false)}
  }

  const tabs:[
    LayoutField,string,readonly CatalogEntry[]
  ][]=[
    ['shortcuts','Acessos rápidos',DASHBOARD_SHORTCUTS],
    ['widgets','Seções do painel',DASHBOARD_WIDGETS],
    ['metrics','Indicadores',DASHBOARD_METRICS],
  ]
  const active=tabs.find(t=>t[0]===activeTab)||tabs[0]

  return <section id="painel" aria-label="Personalizar painel inicial" className="scroll-mt-24 rounded-2xl border border-[#A65A2A]/20 bg-[#141416] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#DFA269]">Meu espaço de trabalho</p><h2 className="mt-1 text-lg font-bold">Personalizar painel inicial</h2>
        <p className="mt-1 text-xs text-gray-400">Escolha o que aparece, oculte o que não utiliza e altere a ordem com as setas. A configuração é individual e acompanha sua conta.</p>
      </div>
      <Link to="/admin" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-xs font-semibold text-[#DFA269]">Ver painel →</Link>
    </div>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias de personalização">
      {tabs.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={activeTab===key} onClick={()=>setActiveTab(key)}
        className={'min-h-10 shrink-0 rounded-xl px-3 text-xs font-semibold '+(activeTab===key?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-400')}>{label}</button>)}
    </div>
    <div className="mt-3">
      {loading?<p role="status" className="py-5 text-sm text-gray-500">Carregando preferências…</p>:
        <OptionList items={active[2]} selected={draft[active[0]]} onChange={next=>change(active[0],next)}/>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-4">
      <button type="button" disabled={busy||loading} onClick={()=>setDraft(normalizeDashboardLayout(DEFAULT_DASHBOARD_LAYOUT))}
        className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-300 disabled:opacity-50">Restaurar padrão</button>
      <button type="button" disabled={busy||loading} onClick={()=>void save()}
        className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-sm font-bold text-white disabled:opacity-50">{busy?'Salvando…':'Salvar meu painel'}</button>
    </div>
    <p className="mt-3 text-[11px] text-gray-500">Os atalhos apenas abrem as áreas existentes. Liberações de cursos, e-books e audiobooks continuam exigindo a autorização própria de cada módulo.</p>
  </section>
}
