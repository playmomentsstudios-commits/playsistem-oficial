import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { motivoStatusCliente,rotulo,statusCliente } from '../../lib/labels.ptBR'

export function AdminCustomers(){
  const [rows,setRows]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [status,setStatus]=useState('todos')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=()=>{setError('');return portalApi.customers().then(setRows).catch((e:any)=>setError(e.message||'Não foi possível carregar os clientes.')).finally(()=>setLoading(false))}
  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(customer=>{
    const text=((customer.first_name||'')+' '+(customer.last_name||'')+' '+customer.email).toLowerCase()
    return text.includes(search.toLowerCase())&&(status==='todos'||customer.status===status)
  }),[rows,search,status])

  const counts=useMemo(()=>({
    all:rows.length,
    active:rows.filter(item=>item.status==='active').length,
    inactive:rows.filter(item=>item.status==='inactive').length,
    blocked:rows.filter(item=>item.status==='blocked').length,
  }),[rows])

  return <div>
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Comercial</p>
      <h1 className="text-2xl font-bold text-white mt-1">Clientes</h1>
      <p className="text-sm text-gray-500">Gestão de contas, acesso e relacionamento.</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {[
        ['todos','Todos',counts.all],
        ['active','Ativos',counts.active],
        ['inactive','Inativos',counts.inactive],
        ['blocked','Bloqueados',counts.blocked],
      ].map(([value,label,count])=><button key={String(value)} type="button" onClick={()=>setStatus(String(value))} className={'text-left p-3 rounded-xl border transition-colors '+(status===value?'border-[#E30613]/40 bg-[#E30613]/10':'border-white/10 bg-[#141416] hover:border-white/20')}>
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className={'text-xl font-bold mt-2 '+(value==='active'?'text-emerald-300':value==='blocked'?'text-red-300':value==='inactive'?'text-amber-300':'text-white')}>{count}</p>
      </button>)}
    </div>

    <div className="flex flex-wrap gap-3 mb-4">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, e-mail..." className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"/>
      <select value={status} onChange={e=>setStatus(e.target.value)} className={"pm-select-status px-3 py-2.5 rounded-xl "+(status==="active"?"pm-state-success":status==="blocked"?"pm-state-danger":status==="inactive"?"pm-state-pending":"pm-state-neutral")}>
        <option value="todos">Todas as situações</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
        <option value="blocked">Bloqueados</option>
      </select>
    </div>

    {loading?<p>Carregando...</p>:error?<div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-sm"><p className="text-red-300">{error}</p><button onClick={()=>{setLoading(true);void load()}} className="text-[#E30613] mt-2">Tentar novamente</button></div>:filtered.length===0?<div className="p-6 rounded-2xl border border-white/10 bg-[#141416] text-sm text-gray-500">Nenhum cliente encontrado.</div>:<div className="rounded-2xl border border-white/10 bg-[#111113] overflow-hidden">
      {filtered.map((customer,index)=><Link key={customer.id} to={'/admin/clientes/'+customer.id} className={'flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors '+(index?'border-t border-white/8':'')}>
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center font-bold text-sm">{((customer.first_name||'?').charAt(0)+(customer.last_name||'').charAt(0)).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{customer.first_name} {customer.last_name}</p>
          <p className="text-xs text-gray-500 truncate">{customer.email}{customer.phone?' · '+customer.phone:''}</p>
          {customer.status_reason_code&&<p className="text-[10px] text-yellow-300/70 mt-1 truncate">{rotulo(motivoStatusCliente,customer.status_reason_code)}</p>}
        </div>
        <div className="flex items-center gap-2"><span className={"pm-tag "+(customer.status==="active"?"pm-tag-success":customer.status==="blocked"?"pm-tag-danger":"pm-tag-pending")}>{rotulo(statusCliente,customer.status)}</span><span className="text-gray-600">›</span></div>
      </Link>)}
    </div>}
  </div>
}
