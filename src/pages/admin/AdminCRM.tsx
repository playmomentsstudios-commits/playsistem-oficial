import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { crmApi,CRM_STAGES,CRM_STAGE_LABELS,type CrmCustomer,type CrmStage } from '../../api/crm'
import { portalApi } from '../../api/portal'
import { settingsApi } from '../../api/settings'
import { useToast } from '../../contexts/ToastContext'

function money(cents:number){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function personName(row:any){
  return [row?.first_name,row?.last_name].filter(Boolean).join(' ')||row?.email||'Cliente'
}
function ownerName(row:any){
  return [row?.first_name,row?.last_name].filter(Boolean).join(' ')||'Sem responsável'
}
function dueLabel(value:string|null){
  if(!value)return 'Sem próxima ação'
  const date=new Date(value)
  const today=new Date()
  const diff=Math.ceil((date.getTime()-today.getTime())/86400000)
  if(diff<0)return 'Atrasada'
  if(diff===0)return 'Hoje'
  if(diff===1)return 'Amanhã'
  return date.toLocaleDateString('pt-BR')
}

export function AdminCRM(){
  const toast=useToast()
  const [rows,setRows]=useState<CrmCustomer[]>([])
  const [team,setTeam]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [owner,setOwner]=useState('all')
  const [loading,setLoading]=useState(true)
  const [dragging,setDragging]=useState<string|null>(null)
  const [followUpDays,setFollowUpDays]=useState(2)

  async function load(){
    try{
      setLoading(true)
      const [crm,people,settings]=await Promise.all([crmApi.list(),portalApi.teamMembers(),settingsApi.appSettings().catch(()=>null)])
      setRows(crm)
      setTeam(people)
      if(settings)setFollowUpDays(settings.crm_default_follow_up_days)
    }catch(error:any){toast(error.message||'Não foi possível carregar o CRM.','error')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(row=>{
    const text=[row.customer?.first_name,row.customer?.last_name,row.customer?.email,row.source,row.next_action].join(' ').toLowerCase()
    return text.includes(search.toLowerCase())&&(owner==='all'||(owner==='none'?!row.owner_id:row.owner_id===owner))
  }),[rows,search,owner])

  const totals=useMemo(()=>({
    active:filtered.filter(row=>!['delivered','lost'].includes(row.stage)).length,
    value:filtered.filter(row=>['quote','negotiation','won'].includes(row.stage)).reduce((sum,row)=>sum+(row.estimated_value||0),0),
    due:filtered.filter(row=>row.next_action_at&&new Date(row.next_action_at).getTime()<Date.now()&&!['delivered','lost'].includes(row.stage)).length,
    won:filtered.filter(row=>row.stage==='won').length,
  }),[filtered])

  async function move(customerId:string,stage:CrmStage){
    const current=rows.find(row=>row.customer_id===customerId)
    if(!current||current.stage===stage)return
    try{
      setRows(list=>list.map(row=>row.customer_id===customerId?{...row,stage}:row))
      await crmApi.save({
        customer_id:customerId,
        stage,
        owner_id:current.owner_id,
        source:current.source,
        next_action:current.next_action,
        next_action_at:current.next_action_at,
        estimated_value:current.estimated_value,
        internal_notes:current.internal_notes,
        lost_reason:stage==='lost'?current.lost_reason:null,
        stage_note:'Movido pelo funil comercial',
      })
    }catch(error:any){
      toast(error.message||'Não foi possível mover o cliente.','error')
      await load()
    }
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#A65A2A] font-semibold">Comercial</p>
        <h1 className="text-2xl font-bold mt-1">CRM Comercial</h1>
        <p className="text-sm text-gray-500 mt-1">Do primeiro contato ao pós-venda, com responsável e próxima ação.</p><p className="text-[10px] text-gray-600 mt-1">Prazo padrão para acompanhamento: {followUpDays} dia(s).</p>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div className="pm-surface p-4"><p className="text-[10px] uppercase text-gray-500">Oportunidades ativas</p><b className="text-2xl">{totals.active}</b></div>
      <div className="pm-surface p-4"><p className="text-[10px] uppercase text-gray-500">Valor em negociação</p><b className="text-lg text-[#A65A2A]">{money(totals.value)}</b></div>
      <div className="pm-surface p-4"><p className="text-[10px] uppercase text-gray-500">Ações atrasadas</p><b className={'text-2xl '+(totals.due?'text-orange-400':'')}>{totals.due}</b></div>
      <div className="pm-surface p-4"><p className="text-[10px] uppercase text-gray-500">Fechados</p><b className="text-2xl text-emerald-400">{totals.won}</b></div>
    </div>

    <div className="pm-surface p-3 flex flex-col sm:flex-row gap-3 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, e-mail, origem ou próxima ação..." className="pm-control flex-1 px-4"/>
      <select value={owner} onChange={e=>setOwner(e.target.value)} className="pm-control px-3 bg-black">
        <option value="all">Todos os responsáveis</option>
        <option value="none">Sem responsável</option>
        {team.map(member=><option key={member.id} value={member.id}>{personName(member)}</option>)}
      </select>
    </div>

    {loading?<div aria-busy="true" className="flex gap-3 overflow-hidden">{Array.from({length:4}).map((_,i)=><div key={i} className="pm-skeleton w-[280px] shrink-0 h-[420px] rounded-2xl"/>)}</div>:<div className="pm-scroll-x pb-4">
      <div className="flex gap-3 min-w-max">
        {CRM_STAGES.map(stage=>{
          const items=filtered.filter(row=>row.stage===stage)
          const total=items.reduce((sum,row)=>sum+(row.estimated_value||0),0)
          return <section
            key={stage}
            onDragOver={e=>e.preventDefault()}
            onDrop={()=>{if(dragging)void move(dragging,stage);setDragging(null)}}
            className={'w-[280px] rounded-2xl bg-[#101012] border overflow-hidden transition-colors '+(dragging?'border-white/15':'border-white/8')}
          >
            <div className="p-3 border-b border-white/8 sticky top-0 bg-[#101012] z-10">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sm">{CRM_STAGE_LABELS[stage]}</h2>
                <span className="min-w-6 h-6 px-1.5 rounded-full bg-white/[0.06] text-[10px] flex items-center justify-center">{items.length}</span>
              </div>
              {total>0&&<p className="text-[10px] text-gray-500 mt-1">{money(total)}</p>}
            </div>
            <div className="p-2 space-y-2 min-h-[180px] max-h-[65vh] overflow-y-auto">
              {items.map(row=><Link
                draggable
                onDragStart={()=>setDragging(row.customer_id)}
                onDragEnd={()=>setDragging(null)}
                key={row.customer_id}
                to={'/admin/clientes/'+row.customer_id}
                className={'block p-3 rounded-xl bg-[#171719] border hover:border-white/20 hover:bg-[#1b1b1e] transition-colors '+(dragging===row.customer_id?'opacity-50 border-[#A65A2A]/30':'border-white/8')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{personName(row.customer)}</p>
                    <p className="text-[10px] text-gray-500 truncate">{row.customer?.email}</p>
                  </div>
                  <span className={'w-2 h-2 rounded-full mt-1.5 shrink-0 '+(row.next_action_at&&new Date(row.next_action_at).getTime()<Date.now()?'bg-orange-400':'bg-gray-600')}/>
                </div>
                {row.estimated_value>0&&<p className="text-xs text-[#A65A2A] font-semibold mt-3">{money(row.estimated_value)}</p>}
                <div className="mt-3 pt-3 border-t border-white/6">
                  <p className="text-[10px] text-gray-500 truncate">{row.next_action||'Sem próxima ação'}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-gray-600 truncate">{ownerName(row.owner)}</span>
                    <span className="text-[10px] text-gray-600 shrink-0">{dueLabel(row.next_action_at)}</span>
                  </div>
                </div>
              </Link>)}
              {items.length===0&&<div className="m-2 min-h-24 rounded-xl border border-dashed border-white/[0.08] flex items-center justify-center text-center px-4 text-[11px] text-gray-600">{dragging?'Solte aqui para mover':'Nenhum cliente nesta etapa'}</div>}
            </div>
          </section>
        })}
      </div>
    </div>}
  </div>
}
