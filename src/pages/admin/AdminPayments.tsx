import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { metodoPagamento,rotulo,statusPagamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100)
const statusTone:Record<string,string>={
  paid:'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  pending:'bg-amber-500/10 text-amber-300 border-amber-500/20',
  awaiting_confirmation:'bg-amber-500/10 text-amber-300 border-amber-500/20',
  refunded:'bg-violet-500/10 text-violet-300 border-violet-500/20',
  cancelled:'bg-white/[0.04] text-gray-400 border-white/10',
  failed:'bg-red-500/10 text-red-300 border-red-500/20',
}
function Metric({label,value,tone='text-white'}:{label:string;value:string|number;tone?:string}){
  return <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">{label}</p><p className={'text-xl font-bold mt-2 '+tone}>{value}</p></div>
}

export function AdminPayments(){
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [statusFilter,setStatusFilter]=useState('todos')
  const [scopeFilter,setScopeFilter]=useState('operacionais')
  const [search,setSearch]=useState('')
  const [selected,setSelected]=useState<any|null>(null)

  const load=async()=>{setLoading(true);try{setRows(await portalApi.payments())}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>rows.filter(payment=>{
    const customer=((payment.customer?.first_name||'')+' '+(payment.customer?.last_name||'')+' '+(payment.customer?.email||'')).toLowerCase()
    const order=(payment.order?.order_number||'').toLowerCase()
    const needle=search.trim().toLowerCase()
    const scopeOk=scopeFilter==='todos'||(scopeFilter==='operacionais'?!payment.archived_at&&payment.environment!=='sandbox':scopeFilter==='testes'?payment.environment==='sandbox'&&!payment.archived_at:scopeFilter==='arquivados'?Boolean(payment.archived_at):true)
    return scopeOk&&(!needle||customer.includes(needle)||order.includes(needle)||(payment.id||'').toLowerCase().includes(needle))&&(statusFilter==='todos'||payment.status===statusFilter)
  }),[rows,statusFilter,scopeFilter,search])

  const operationalRows=useMemo(()=>rows.filter(p=>!p.archived_at&&p.environment!=='sandbox'),[rows])
  const totals=useMemo(()=>({
    received:operationalRows.filter(p=>p.status==='paid').reduce((sum,p)=>sum+(p.amount||0),0),
    pending:operationalRows.filter(p=>['pending','awaiting_confirmation'].includes(p.status)).reduce((sum,p)=>sum+(p.amount||0),0),
    paid:operationalRows.filter(p=>p.status==='paid').length,
    attention:operationalRows.filter(p=>['pending','awaiting_confirmation','failed'].includes(p.status)).length,
  }),[operationalRows])

  async function setArchived(payment:any,archived:boolean){
    if(payment.environment!=='sandbox')return toast('Somente pagamentos confirmados como Sandbox podem ser arquivados.','error')
    if(!window.confirm(archived?'Arquivar este pagamento Sandbox? Ele sairá dos indicadores operacionais.':'Restaurar este pagamento Sandbox?'))return
    try{await portalApi.setPaymentArchived(payment.id,archived);toast(archived?'Pagamento de teste arquivado.':'Pagamento de teste restaurado.','success');setSelected(null);await load()}
    catch(e:any){toast(e.message||'Não foi possível atualizar o pagamento de teste.','error')}
  }

  async function cancelPayment(payment:any){
    if(!window.confirm('Cancelar esta cobrança? Pagamentos Asaas pendentes também serão cancelados no provedor.'))return
    try{
      const {data,error}=await supabase.functions.invoke('asaas-admin-cancel',{body:{payment_id:payment.id}})
      if(error)throw error
      if(!data?.ok)throw new Error(data?.error||'Não foi possível cancelar a cobrança.')
      toast('Cobrança cancelada.','success');setSelected(null);await load()
    }catch(e:any){toast(e.message||'Não foi possível cancelar a cobrança.','error')}
  }

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Financeiro</p><h1 className="text-2xl font-bold text-white mt-1">Pagamentos</h1><p className="text-sm text-gray-500 mt-1">Cobranças, recebimentos e histórico financeiro em um só lugar.</p></div>
      <button onClick={()=>void load()} className="min-h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-gray-300 hover:bg-white/[0.08]">Atualizar</button>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <Metric label="Recebido" value={money(totals.received)} tone="text-emerald-300"/>
      <Metric label="A receber" value={money(totals.pending)} tone="text-amber-300"/>
      <Metric label="Pagamentos confirmados" value={totals.paid}/>
      <Metric label="Precisam de atenção" value={totals.attention} tone={totals.attention?'text-amber-300':'text-emerald-300'}/>
    </div>

    <div className="p-3 rounded-2xl bg-[#111113] border border-white/10 flex flex-wrap gap-3 mb-5">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente, pedido ou ID..." className="min-h-11 flex-1 min-w-64 px-4 rounded-xl bg-black/40 border border-white/10 outline-none focus:border-[#E30613]/50"/>
      <select value={scopeFilter} onChange={e=>setScopeFilter(e.target.value)} className="min-h-11 px-3 rounded-xl bg-black border border-white/10">
        <option value="operacionais">Operacionais</option><option value="testes">Testes Sandbox</option><option value="arquivados">Arquivados</option><option value="todos">Todos os registros</option>
      </select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="min-h-11 px-3 rounded-xl bg-black border border-white/10">
        <option value="todos">Todos os status</option><option value="pending">Aguardando pagamento</option><option value="paid">Pagamento recebido</option><option value="cancelled">Cancelado</option><option value="refunded">Reembolsado</option>
      </select>
    </div>

    {loading?<div className="py-16 text-center text-sm text-gray-500">Carregando financeiro...</div>:!filtered.length?<div className="p-8 rounded-2xl bg-[#141416] border border-white/10 text-center text-sm text-gray-500">Nenhum pagamento encontrado com estes filtros.</div>:<div className="rounded-2xl bg-[#111113] border border-white/10 overflow-hidden">
      {filtered.map((payment,index)=>{
        const customerName=[payment.customer?.first_name,payment.customer?.last_name].filter(Boolean).join(' ')||'Cliente'
        return <button key={payment.id} onClick={()=>setSelected(payment)} className={'w-full text-left p-4 hover:bg-white/[0.025] transition-colors '+(index?'border-t border-white/[0.07]':'')}>
          <div className="grid md:grid-cols-[1.1fr_1fr_.8fr_auto] gap-3 md:items-center">
            <div><p className="font-semibold text-white">{payment.order?.order_number||'Pagamento sem pedido'}</p><p className="text-xs text-gray-500 mt-1">{customerName} · {payment.customer?.email||'Sem e-mail'}</p></div>
            <div><p className="font-semibold">{money(payment.amount)}</p><p className="text-xs text-gray-500 mt-1">{rotulo(metodoPagamento,payment.method)}</p></div>
            <p className="text-xs text-gray-500">{new Date(payment.created_at).toLocaleString('pt-BR')}</p>
            <div className="flex flex-wrap gap-1.5 justify-self-start md:justify-self-end">{payment.environment==='sandbox'&&<span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] bg-sky-500/10 text-sky-300 border-sky-500/20">Sandbox</span>}{payment.archived_at&&<span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] bg-white/5 text-gray-400 border-white/10">Arquivado</span>}<span className={'inline-flex px-2.5 py-1 rounded-full border text-[11px] '+(statusTone[payment.status]||'bg-white/5 text-gray-300 border-white/10')}>{rotulo(statusPagamento,payment.status)}</span></div>
          </div>
        </button>
      })}
    </div>}

    {selected&&<div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex justify-end" onClick={()=>setSelected(null)}>
      <aside className="w-full max-w-lg h-full bg-[#101012] border-l border-white/10 p-5 sm:p-6 overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.16em] text-[#E30613]">Detalhes financeiros</p><h2 className="text-xl font-bold mt-1">{selected.order?.order_number||'Pagamento'}</h2></div><button onClick={()=>setSelected(null)} className="w-9 h-9 rounded-xl bg-white/5 text-gray-400">✕</button></div>
        <div className="mt-6 p-5 rounded-2xl bg-[#171719] border border-white/10"><p className="text-xs text-gray-500">Valor</p><p className="text-3xl font-bold mt-1">{money(selected.amount)}</p><span className={'mt-4 inline-flex px-3 py-1.5 rounded-full border text-xs '+(statusTone[selected.status]||'bg-white/5 text-gray-300 border-white/10')}>{rotulo(statusPagamento,selected.status)}</span></div>
        <div className="mt-4 rounded-2xl border border-white/10 divide-y divide-white/[0.07]">
          {[['Cliente',[selected.customer?.first_name,selected.customer?.last_name].filter(Boolean).join(' ')||'Cliente'],['E-mail',selected.customer?.email||'—'],['Método',rotulo(metodoPagamento,selected.method)],['Provedor',selected.provider||'—'],['Criado em',new Date(selected.created_at).toLocaleString('pt-BR')],['ID interno',selected.id]].map(([label,value])=><div key={label} className="p-4"><p className="text-[10px] uppercase text-gray-600">{label}</p><p className="text-sm text-gray-300 mt-1 break-all">{value}</p></div>)}
        </div>
        {selected.environment==='sandbox'&&<div className="mt-4 p-4 rounded-xl bg-sky-500/5 border border-sky-500/15 text-xs text-sky-200">Ambiente Sandbox confirmado. Este registro pode ser retirado dos indicadores sem apagar a trilha financeira.</div>}
        {selected.provider==='manual'&&<div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200">Pagamento manual legado — preservado apenas para histórico.</div>}
        {!['paid','refunded','cancelled'].includes(selected.status)&&<button onClick={()=>void cancelPayment(selected)} className="mt-5 w-full min-h-11 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-semibold">Cancelar cobrança</button>}
        {selected.environment==='sandbox'&&<button onClick={()=>void setArchived(selected,!selected.archived_at)} className="mt-3 w-full min-h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-sm font-semibold">{selected.archived_at?'Restaurar pagamento de teste':'Arquivar pagamento de teste'}</button>}
        <div className="mt-5 p-4 rounded-xl bg-white/[0.025] border border-white/[0.07]"><p className="text-xs font-semibold text-gray-300">Histórico protegido</p><p className="text-[11px] text-gray-600 mt-1">Registros financeiros não são apagados. Somente cobranças comprovadamente Sandbox podem ser arquivadas e restauradas, mantendo auditoria.</p></div>
      </aside>
    </div>}
  </div>
}
