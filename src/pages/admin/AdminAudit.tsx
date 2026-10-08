import { useEffect,useMemo,useState } from 'react'
import { reportsApi } from '../../api/reports'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'

const tableLabels:Record<string,string>={
  products:'Produtos',
  orders:'Pedidos',
  quotes:'Orçamentos',
  payments:'Pagamentos',
  projects:'Projetos',
  tasks:'Tarefas',
  client_files:'Arquivos',
  staff_profiles:'Colaboradores',
  customer_crm:'CRM',
  conversations:'Conversas',
}
const actionLabels:Record<string,string>={
  insert:'Criou',
  update:'Alterou',
  delete:'Excluiu',
}

function actorName(row:any){
  const actor=row.actor
  return [actor?.first_name,actor?.last_name].filter(Boolean).join(' ')||actor?.email||row.actor_role||'Sistema'
}

function changedFields(row:any){
  if(row.action!=='update'||!row.old_data||!row.new_data)return []
  const keys=Array.from(new Set([...Object.keys(row.old_data),...Object.keys(row.new_data)]))
  return keys.filter(key=>JSON.stringify(row.old_data[key])!==JSON.stringify(row.new_data[key]))
}

function preview(value:any){
  if(value===null||value===undefined)return '—'
  if(typeof value==='object')return JSON.stringify(value).slice(0,120)
  return String(value).slice(0,120)
}

export function AdminAudit(){
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [team,setTeam]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [table,setTable]=useState('all')
  const [action,setAction]=useState('all')
  const [actor,setActor]=useState('')
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<any>(null)

  async function load(){
    try{
      setLoading(true)
      const [audit,people]=await Promise.all([
        reportsApi.audit({table,action,actor:actor||undefined,limit:300}),
        portalApi.teamMembers(),
      ])
      setRows(audit)
      setTeam(people)
    }catch(error:any){toast(error.message||'Não foi possível carregar a auditoria.','error')}
    finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase()
    if(!q)return rows
    return rows.filter(row=>[
      tableLabels[row.table_name]||row.table_name,
      actionLabels[row.action]||row.action,
      actorName(row),
      row.record_id,
      JSON.stringify(row.old_data||{}),
      JSON.stringify(row.new_data||{}),
    ].join(' ').toLowerCase().includes(q))
  },[rows,search])

  return <div>
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#A65A2A] font-semibold">Segurança</p>
      <h1 className="text-2xl font-bold mt-1">Auditoria</h1>
      <p className="text-sm text-gray-500 mt-1">Histórico de alterações administrativas e operacionais importantes.</p>
    </div>

    <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 mb-5">
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar ação, pessoa, ID..." className="min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"/>
        <select value={table} onChange={e=>setTable(e.target.value)} className="min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm">
          <option value="all">Todos os módulos</option>
          {Object.entries(tableLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        <select value={action} onChange={e=>setAction(e.target.value)} className="min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm">
          <option value="all">Todas as ações</option>
          <option value="insert">Criações</option>
          <option value="update">Alterações</option>
          <option value="delete">Exclusões</option>
        </select>
        <select value={actor} onChange={e=>setActor(e.target.value)} className="min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm">
          <option value="">Todos os usuários</option>
          {team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name||''}</option>)}
        </select>
        <button onClick={()=>void load()} disabled={loading} className="min-h-11 px-4 rounded-xl bg-[#A65A2A] text-white text-sm font-semibold disabled:opacity-40">{loading?'Atualizando...':'Aplicar filtros'}</button>
      </div>
    </div>

    <div className="rounded-2xl bg-[#141416] border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{filtered.length} registro(s)</p>
        <p className="text-[10px] text-gray-600">Últimos 300 eventos carregados</p>
      </div>
      {loading?<div className="py-16 text-center text-sm text-gray-500">Carregando auditoria...</div>:filtered.length===0?<div className="py-16 text-center text-sm text-gray-600">Nenhum evento encontrado.</div>:<div className="divide-y divide-white/6">
        {filtered.map(row=>{
          const fields=changedFields(row)
          return <button key={row.id} onClick={()=>setSelected(row)} className="w-full text-left p-4 hover:bg-white/[0.025] transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={'px-2 py-1 rounded-full text-[10px] font-semibold '+(row.action==='delete'?'bg-red-500/10 text-red-400':row.action==='insert'?'bg-emerald-500/10 text-emerald-400':'bg-blue-500/10 text-blue-300')}>{actionLabels[row.action]||row.action}</span>
                  <span className="text-sm font-semibold">{tableLabels[row.table_name]||row.table_name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{actorName(row)}{row.record_id?' · '+row.record_id:''}</p>
                {fields.length>0&&<p className="text-[10px] text-gray-600 mt-1 truncate">Campos: {fields.slice(0,5).join(', ')}{fields.length>5?'…':''}</p>}
              </div>
              <span className="text-[10px] text-gray-600 shrink-0">{new Date(row.created_at).toLocaleString('pt-BR')}</span>
            </div>
          </button>
        })}
      </div>}
    </div>

    {selected&&<div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null)}}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-[#111113] border border-white/10 shadow-2xl">
        <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-semibold text-sm">{actionLabels[selected.action]} · {tableLabels[selected.table_name]||selected.table_name}</p><p className="text-[10px] text-gray-500">{actorName(selected)} · {new Date(selected.created_at).toLocaleString('pt-BR')}</p></div>
          <button onClick={()=>setSelected(null)} className="w-9 h-9 rounded-lg bg-white/[0.05]">×</button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-56px)]">
          {selected.action==='update'?<div className="space-y-2">
            {changedFields(selected).map(field=><div key={field} className="grid md:grid-cols-[150px_1fr_1fr] gap-2 p-3 rounded-xl bg-white/[0.035] border border-white/8">
              <div className="text-xs font-semibold">{field}</div>
              <div><p className="text-[9px] uppercase text-gray-600 mb-1">Antes</p><p className="text-xs break-words">{preview(selected.old_data?.[field])}</p></div>
              <div><p className="text-[9px] uppercase text-gray-600 mb-1">Depois</p><p className="text-xs break-words">{preview(selected.new_data?.[field])}</p></div>
            </div>)}
          </div>:<pre className="text-xs whitespace-pre-wrap break-words p-3 rounded-xl bg-black/30 border border-white/8">{JSON.stringify(selected.action==='delete'?selected.old_data:selected.new_data,null,2)}</pre>}
        </div>
      </div>
    </div>}
  </div>
}
