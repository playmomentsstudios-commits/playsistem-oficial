import { useEffect,useMemo,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { motivoStatusCliente,nivelCliente,rotulo,statusCliente,statusPagamento,statusProjeto } from '../../lib/labels.ptBR'

const reasons=[
  'payment_pending','information_incomplete','terms_violation','prolonged_inactivity',
  'customer_request','security_review','platform_misuse','commercial_relationship_ended','administrative_other',
]

function money(cents:number|undefined|null){
  return ((cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}

function customerAge(createdAt:string){
  const days=Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/86400000))
  if(days<30)return days+' dias'
  const months=Math.floor(days/30)
  if(months<12)return months+' '+(months===1?'mês':'meses')
  const years=Math.floor(months/12)
  const rest=months%12
  return years+' '+(years===1?'ano':'anos')+(rest?' e '+rest+' '+(rest===1?'mês':'meses'):'')
}

export function AdminCustomerDetail(){
  const {id=''}=useParams()
  const navigate=useNavigate()
  const {user}=useAuth()
  const toast=useToast()
  const [customer,setCustomer]=useState<any>(null)
  const [orders,setOrders]=useState<any[]>([])
  const [projects,setProjects]=useState<any[]>([])
  const [payments,setPayments]=useState<any[]>([])
  const [loyalty,setLoyalty]=useState<any>(null)
  const [settings,setSettings]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [targetStatus,setTargetStatus]=useState<'active'|'inactive'|'blocked'>('inactive')
  const [reason,setReason]=useState('payment_pending')
  const [saving,setSaving]=useState(false)
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [deleteConfirmation,setDeleteConfirmation]=useState('')
  const [deleting,setDeleting]=useState(false)

  const load=async()=>{
    const [customersList,allOrders,allProjects,allPayments,loyaltyRow,loyaltySettings,statusHistory]=await Promise.all([
      portalApi.customers(),portalApi.orders(),portalApi.projects(),portalApi.payments(),
      portalApi.customerLoyalty(id),portalApi.loyaltySettings(),portalApi.customerStatusHistory(id),
    ])
    setCustomer(customersList.find((item:any)=>item.id===id)||null)
    setOrders(allOrders.filter((item:any)=>item.customer_id===id))
    setProjects(allProjects.filter((item:any)=>item.customer_id===id))
    setPayments(allPayments.filter((item:any)=>item.customer_id===id))
    setLoyalty(loyaltyRow)
    setSettings(loyaltySettings)
    setHistory(statusHistory)
  }

  useEffect(()=>{void load()},[id])

  const totalPaid=payments.filter(item=>item.status==='paid').reduce((sum,item)=>sum+(item.amount||0),0)
  const servicesDone=orders.filter(order=>order.payment_status==='paid').flatMap(order=>order.items||[]).filter((item:any)=>item.item_type==='service').reduce((sum:number,item:any)=>sum+(item.quantity||1),0)
  const availableCash=Math.max(0,(loyalty?.unlocked_cash||0)-(loyalty?.used_cash||0))
  const lockedCash=Math.max(0,(loyalty?.generated_cash||0)-(loyalty?.unlocked_cash||0))

  const timeline=useMemo(()=>{
    if(!customer)return []
    const events:any[]=[{date:customer.created_at,title:'Cadastro criado',description:'Entrada na plataforma Play Moments'}]
    projects.forEach(project=>events.push({date:project.created_at||project.updated_at,title:'Projeto criado',description:project.title}))
    projects.filter(project=>project.status==='completed').forEach(project=>events.push({date:project.updated_at,title:'Projeto concluído',description:project.title}))
    payments.filter(payment=>payment.status==='paid'&&payment.paid_at).forEach(payment=>events.push({date:payment.paid_at,title:'Pagamento confirmado',description:money(payment.amount)}))
    return events.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())
  },[customer,projects,payments])

  async function changeStatus(){
    if(!customer)return
    setSaving(true)
    try{
      await portalApi.setCustomerStatus(customer.id,targetStatus,targetStatus==='active'?null:reason)
      toast(targetStatus==='active'?'Cliente reativado.':'Status do cliente atualizado.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setSaving(false)}
  }

  async function deleteCustomer(){
    if(!customer||deleteConfirmation.trim().toLowerCase()!==customer.email.trim().toLowerCase())return
    setDeleting(true)
    try{
      await portalApi.deleteCustomer(customer.id,deleteConfirmation)
      toast('Cliente excluído permanentemente.','success')
      navigate('/admin/clientes',{replace:true})
    }catch(error:any){
      toast(error.message||'Não foi possível excluir o cliente.','error')
    }finally{
      setDeleting(false)
    }
  }

  async function saveLoyalty(){
    if(!settings||!user)return
    setSaving(true)
    try{
      await portalApi.saveLoyaltySettings({
        cashback_basis_points:Number(settings.cashback_basis_points)||0,
        silver_threshold:settings.silver_threshold===null||settings.silver_threshold===''?null:Number(settings.silver_threshold),
        gold_threshold:settings.gold_threshold===null||settings.gold_threshold===''?null:Number(settings.gold_threshold),
        updated_by:user.id,
      })
      toast('Regras do Play Cash atualizadas.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setSaving(false)}
  }

  if(!customer)return <p className="text-gray-400">Carregando cliente...</p>

  return <div>
    <Link to="/admin/clientes" className="text-sm text-[#E30613]">← Clientes</Link>
    <div className="flex flex-wrap justify-between gap-4 mt-4">
      <div>
        <h1 className="text-2xl font-bold">{customer.first_name} {customer.last_name}</h1>
        <p className="text-gray-400">{customer.email} · {customer.phone||'Sem telefone'}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Status</p>
        <p className={'font-semibold '+(customer.status==='active'?'text-green-400':customer.status==='blocked'?'text-red-400':'text-yellow-300')}>{rotulo(statusCliente,customer.status)}</p>
        {customer.status_reason_code&&<p className="text-xs text-gray-500 mt-1">{rotulo(motivoStatusCliente,customer.status_reason_code)}</p>}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Cliente há</p><b className="text-lg">{customerAge(customer.created_at)}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Serviços pagos</p><b className="text-2xl">{servicesDone}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Total pago</p><b className="text-lg">{money(totalPaid)}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Nível</p><b className="text-lg">{rotulo(nivelCliente,loyalty?.level||'bronze')}</b></div>
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-xs text-gray-500">Play Cash disponível</p><b className="text-lg text-[#E30613]">{money(availableCash)}</b></div>
    </div>

    <div className="grid xl:grid-cols-2 gap-5 mt-6">
      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-bold">Play Cash e fidelidade</h2>
        <p className="text-sm text-gray-500 mt-1">Crédito gerado somente sobre serviços efetivamente pagos.</p>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="p-3 rounded-xl bg-white/5"><p className="text-gray-500">Gasto em serviços</p><b>{money(loyalty?.lifetime_service_spend)}</b></div>
          <div className="p-3 rounded-xl bg-white/5"><p className="text-gray-500">Play Cash gerado</p><b>{money(loyalty?.generated_cash)}</b></div>
          <div className="p-3 rounded-xl bg-white/5"><p className="text-gray-500">Disponível em desconto</p><b className="text-green-400">{money(availableCash)}</b></div>
          <div className="p-3 rounded-xl bg-white/5"><p className="text-gray-500">Aguardando próximo nível</p><b className="text-yellow-300">{money(lockedCash)}</b></div>
        </div>

        {settings&&<div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">Configuração global do programa</h3>
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            <label className="text-xs text-gray-400">Cashback (%)
              <input type="number" step="0.1" value={(settings.cashback_basis_points||0)/100} onChange={e=>setSettings({...settings,cashback_basis_points:Math.round(Number(e.target.value)*100)})} className="mt-1 w-full px-3 py-2 rounded-lg bg-black border border-white/10"/>
            </label>
            <label className="text-xs text-gray-400">Prata a partir de (R$)
              <input type="number" step="0.01" value={settings.silver_threshold===null?'':settings.silver_threshold/100} onChange={e=>setSettings({...settings,silver_threshold:e.target.value===''?null:Math.round(Number(e.target.value)*100)})} className="mt-1 w-full px-3 py-2 rounded-lg bg-black border border-white/10"/>
            </label>
            <label className="text-xs text-gray-400">Ouro a partir de (R$)
              <input type="number" step="0.01" value={settings.gold_threshold===null?'':settings.gold_threshold/100} onChange={e=>setSettings({...settings,gold_threshold:e.target.value===''?null:Math.round(Number(e.target.value)*100)})} className="mt-1 w-full px-3 py-2 rounded-lg bg-black border border-white/10"/>
            </label>
          </div>
          <button disabled={saving} onClick={saveLoyalty} className="mt-3 px-4 py-2 rounded-xl bg-[#E30613] text-sm disabled:opacity-50">Salvar regras do Play Cash</button>
          <p className="text-[11px] text-gray-600 mt-2">Enquanto os valores de Prata e Ouro estiverem vazios, todos permanecem no nível Bronze.</p>
        </div>}
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-bold">Acesso do cliente</h2>
        <p className="text-sm text-gray-500 mt-1">Inativar ou bloquear preserva os dados, mas remove o acesso ao portal e às vantagens.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <select value={targetStatus} onChange={e=>setTargetStatus(e.target.value as any)} className="px-3 py-2 rounded-xl bg-black border border-white/10">
            <option value="active">Ativar / reativar</option>
            <option value="inactive">Inativar</option>
            <option value="blocked">Bloquear</option>
          </select>
          {targetStatus!=='active'&&<select value={reason} onChange={e=>setReason(e.target.value)} className="px-3 py-2 rounded-xl bg-black border border-white/10">{reasons.map(code=><option key={code} value={code}>{rotulo(motivoStatusCliente,code)}</option>)}</select>}
        </div>
        <button disabled={saving||targetStatus===customer.status} onClick={changeStatus} className="mt-3 px-4 py-2 rounded-xl bg-white/10 text-sm disabled:opacity-40">{targetStatus==='active'?'Reativar cliente':targetStatus==='blocked'?'Bloquear cliente':'Inativar cliente'}</button>
        {user?.role==='admin'&&<div className="mt-5 border-t border-red-500/15 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-red-300">Excluir cliente</h3>
              <p className="text-xs text-gray-500 mt-1">Exclusão permanente somente para cadastros sem histórico operacional. Clientes com pedidos, pagamentos, projetos, orçamentos ou conversas devem ser inativados ou bloqueados.</p>
            </div>
            <button type="button" onClick={()=>{setDeleteConfirmation('');setDeleteOpen(true)}} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs shrink-0">Excluir</button>
          </div>
        </div>}

        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold">Histórico de acesso</h3>
          <div className="mt-2 space-y-2">{history.length===0?<p className="text-xs text-gray-500">Nenhuma alteração registrada.</p>:history.map(item=><div key={item.id} className="text-xs p-2 rounded-lg bg-white/5"><b>{rotulo(statusCliente,item.new_status)}</b>{item.reason_code?' · '+rotulo(motivoStatusCliente,item.reason_code):''}<p className="text-gray-600 mt-1">{new Date(item.created_at).toLocaleString('pt-BR')}</p></div>)}</div>
        </div>
      </section>
    </div>

    <section className="mt-6 p-5 rounded-2xl bg-[#141416] border border-white/10">
      <h2 className="font-bold">Caminho do cliente</h2>
      <p className="text-sm text-gray-500 mb-4">Linha do tempo do relacionamento com a Play Moments</p>
      <div className="relative pl-5 border-l border-white/10 space-y-5">{timeline.map((event,index)=><div key={event.date+event.title+index} className="relative">
        <span className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-[#E30613]"/>
        <p className="text-sm font-semibold">{event.title}</p>
        <p className="text-xs text-gray-400">{event.description}</p>
        <p className="text-[11px] text-gray-600 mt-1">{new Date(event.date).toLocaleString('pt-BR')}</p>
      </div>)}</div>
    </section>

    <div className="grid lg:grid-cols-3 gap-4 mt-6">
      <div className="p-5 rounded-2xl bg-[#141416] border border-white/10"><h2 className="font-bold mb-3">Projetos ({projects.length})</h2>{projects.length===0?<p className="text-sm text-gray-500">Nenhum projeto.</p>:projects.map(project=><Link key={project.id} to={'/admin/projetos/'+project.id} className="block text-sm py-1">{project.title} — {rotulo(statusProjeto,project.status)}</Link>)}</div>
      <div className="p-5 rounded-2xl bg-[#141416] border border-white/10"><h2 className="font-bold mb-3">Pedidos ({orders.length})</h2>{orders.length===0?<p className="text-sm text-gray-500">Nenhum pedido.</p>:orders.slice(0,8).map(order=><Link key={order.id} to={'/admin/pedidos/'+order.id} className="block text-sm py-1">{order.order_number}</Link>)}</div>
      <div className="p-5 rounded-2xl bg-[#141416] border border-white/10"><h2 className="font-bold mb-3">Pagamentos</h2>{payments.length===0?<p className="text-sm text-gray-500">Nenhum pagamento.</p>:payments.slice(0,8).map(payment=><p key={payment.id} className="text-sm py-1">{money(payment.amount)} — {rotulo(statusPagamento,payment.status)}</p>)}</div>
    </div>

    <Link to="/admin/conversas" className="inline-block mt-5 px-4 py-3 rounded-xl bg-[#E30613]">Abrir central de conversa</Link>

    {deleteOpen&&<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.currentTarget===e.target&&!deleting)setDeleteOpen(false)}}>
      <div className="w-full max-w-md rounded-2xl bg-[#111113] border border-red-500/20 shadow-2xl p-5">
        <div className="flex justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Excluir cliente?</h2>
            <p className="text-sm text-gray-500 mt-1">Esta ação remove a conta de acesso e, quando não houver histórico operacional, também remove a pasta exclusiva desse cliente no Google Drive.</p>
          </div>
          <button type="button" disabled={deleting} onClick={()=>setDeleteOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 text-gray-400">×</button>
        </div>

        <div className="mt-5 p-3 rounded-xl bg-red-500/[0.06] border border-red-500/15">
          <p className="text-xs text-red-300">Para confirmar, digite exatamente o e-mail do cliente:</p>
          <p className="text-xs font-semibold mt-1">{customer.email}</p>
        </div>

        <input value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} placeholder={customer.email} className="mt-4 w-full px-3 py-2.5 rounded-xl bg-black border border-white/10"/>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" disabled={deleting} onClick={()=>setDeleteOpen(false)} className="px-4 py-2 rounded-xl bg-white/5 text-sm">Cancelar</button>
          <button type="button" disabled={deleting||deleteConfirmation.trim().toLowerCase()!==customer.email.trim().toLowerCase()} onClick={deleteCustomer} className="px-4 py-2 rounded-xl bg-red-600 text-sm disabled:opacity-40">{deleting?'Excluindo...':'Excluir permanentemente'}</button>
        </div>
      </div>
    </div>}
  </div>
}
