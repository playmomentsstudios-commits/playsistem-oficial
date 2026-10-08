import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'

type Summary={
  counts:Record<string,number>
  campaigns:Array<{campaign_code:string;total:number}>
  checkout_to_payment_percent:number
  checkout_started:number
  payment_created:number
}

type ViewSummary={
  period_days:number
  total_views:number
  today_views:number
  by_type:Array<{content_type:string;total:number}>
  top_items:Array<{content_type:string;content_key:string;path:string;label:string;total:number}>
  daily:Array<{date:string;total:number}>
}

const labels:Record<string,string>={
  service_interest:'Interesse em serviços',
  product_interest:'Interesse em produtos',
  academy_interest:'Interesse na Academia',
  account_interest:'Interesse em conta',
  checkout_started:'Checkout iniciado',
  payment_created:'Pagamento criado',
  payment_failed:'Pagamento falhou',
}

const typeLabels:Record<string,string>={
  page:'Páginas',
  product:'Produtos',
  service:'Serviços',
  resume:'Currículos',
  landing:'Landing pages',
  course:'Cursos',
}

export function AdminConversion(){
  const[data,setData]=useState<Summary|null>(null)
  const[views,setViews]=useState<ViewSummary|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[viewsError,setViewsError]=useState('')
  const[days,setDays]=useState(30)
  const[retry,setRetry]=useState(0)

  useEffect(()=>{
    let active=true
    setLoading(true)
    setError('')
    setViewsError('')

    void Promise.all([
      supabase.rpc('conversion_funnel_summary',{p_days:days}),
      supabase.rpc('public_view_summary',{p_days:days}),
    ]).then(([funnelResult,viewResult])=>{
      if(!active)return

      if(funnelResult.error){
        setError('Não foi possível carregar os dados de conversão. Verifique a conexão e a migration do funil.')
        setData(null)
      }else{
        setData(funnelResult.data as Summary)
      }

      if(viewResult.error){
        setViewsError('As visualizações ainda não estão disponíveis. Verifique a migration de audiência.')
        setViews(null)
      }else{
        setViews(viewResult.data as ViewSummary)
      }

      setLoading(false)
    }).catch(()=>{
      if(!active)return
      setError('Não foi possível carregar os relatórios.')
      setViewsError('Não foi possível carregar a audiência.')
      setLoading(false)
    })

    return()=>{active=false}
  },[days,retry])

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[.18em] text-[#A65A2A] font-semibold">Conversão & audiência</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">Desempenho do site</h1>
        <p className="text-sm text-gray-500 mt-1">Visualizações únicas diárias por conteúdo e jornada pública até o pagamento.</p>
      </div>
      <select value={days} onChange={e=>setDays(Number(e.target.value))} className="bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-sm">
        <option value={7}>7 dias</option>
        <option value={30}>30 dias</option>
        <option value={90}>90 dias</option>
      </select>
    </div>

    {loading?<div className="pm-skeleton h-44 rounded-2xl"/>:<>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Audiência do site</h2>
          <p className="text-xs text-gray-500 mt-1">O mesmo IP conta no máximo uma vez por conteúdo em cada dia. O endereço IP bruto não é armazenado.</p>
        </div>

        {viewsError?<div className="pm-surface p-5 border border-amber-500/20">
          <p className="text-sm text-amber-200">{viewsError}</p>
          <button onClick={()=>setRetry(v=>v+1)} className="mt-3 text-xs font-semibold text-[#ff5364]">Tentar novamente</button>
        </div>:views&&<>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="pm-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">No período</p>
              <p className="text-3xl font-bold mt-2">{views.total_views||0}</p>
              <p className="text-xs text-gray-600 mt-1">visualizações únicas por conteúdo</p>
            </div>
            <div className="pm-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Hoje</p>
              <p className="text-3xl font-bold mt-2 text-[#A65A2A]">{views.today_views||0}</p>
              <p className="text-xs text-gray-600 mt-1">visualizações únicas</p>
            </div>
            {views.by_type.slice(0,2).map(item=><div key={item.content_type} className="pm-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{typeLabels[item.content_type]||item.content_type}</p>
              <p className="text-3xl font-bold mt-2">{item.total}</p>
              <p className="text-xs text-gray-600 mt-1">no período selecionado</p>
            </div>)}
          </div>

          {views.by_type.length>2&&<div className="flex flex-wrap gap-2">
            {views.by_type.slice(2).map(item=><span key={item.content_type} className="pm-tag pm-tag-neutral">{typeLabels[item.content_type]||item.content_type}: {item.total}</span>)}
          </div>}

          <section className="pm-surface p-4 md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold">Conteúdos mais vistos</h3>
                <p className="text-xs text-gray-500 mt-1">Páginas, produtos, serviços, currículos, cursos e landings no mesmo ranking.</p>
              </div>
              <span className="text-xs text-gray-600">{days} dias</span>
            </div>

            {views.top_items?.length?<div className="mt-4 divide-y divide-white/[.07]">
              {views.top_items.map((item,index)=><div key={item.content_type+':'+item.content_key} className="py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-white/[.05] flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{index+1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold truncate">{item.label}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[.05] text-gray-500">{typeLabels[item.content_type]||item.content_type}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 truncate mt-1">{item.path}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{item.total}</p>
                  <p className="text-[10px] text-gray-600">visualizações</p>
                </div>
              </div>)}
            </div>:<p className="text-sm text-gray-500 mt-4">Ainda não há visualizações registradas neste período.</p>}
          </section>
        </>}
      </section>

      <section className="mt-8 pt-7 border-t border-white/[.07]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Funil de conversão</h2>
          <p className="text-xs text-gray-500 mt-1">Eventos da jornada pública até contratação e pagamento.</p>
        </div>

        {error?<div className="pm-surface p-5 border border-amber-500/20">
          <p className="text-sm text-amber-200">{error}</p>
          <button onClick={()=>setRetry(v=>v+1)} className="mt-3 text-xs font-semibold text-[#ff5364]">Tentar novamente</button>
        </div>:data&&<>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(labels).map(([key,label])=><div key={key} className="pm-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-2xl font-bold mt-2">{data.counts?.[key]||0}</p>
            </div>)}
          </div>
          <div className="grid lg:grid-cols-2 gap-4 mt-5">
            <section className="pm-surface p-5">
              <h3 className="font-semibold">Checkout → pagamento</h3>
              <p className="text-3xl font-bold text-[#A65A2A] mt-3">{data.checkout_to_payment_percent||0}%</p>
              <p className="text-xs text-gray-500 mt-2">{data.payment_created||0} pagamentos criados para {data.checkout_started||0} checkouts iniciados. Indicador operacional por eventos, não por usuários únicos.</p>
            </section>
            <section className="pm-surface p-5">
              <h3 className="font-semibold">Campanhas com eventos</h3>
              {data.campaigns?.length?<div className="mt-3 space-y-2">
                {data.campaigns.map(item=><div key={item.campaign_code} className="flex justify-between text-sm"><span className="truncate text-gray-300">{item.campaign_code}</span><strong>{item.total}</strong></div>)}
              </div>:<p className="text-sm text-gray-500 mt-3">Nenhuma campanha atribuída no período.</p>}
            </section>
          </div>
        </>}
      </section>
    </>}
  </div>
}
