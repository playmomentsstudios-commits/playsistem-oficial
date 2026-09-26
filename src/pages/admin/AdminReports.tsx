import { useEffect,useMemo,useState } from 'react'
import { reportsApi,type OperationalReport } from '../../api/reports'
import { useToast } from '../../contexts/ToastContext'

function money(value:number){
  return ((Number(value)||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function isoDate(date:Date){
  return date.toISOString().slice(0,10)
}
function startOfMonth(){
  const now=new Date()
  return isoDate(new Date(now.getFullYear(),now.getMonth(),1))
}
function today(){return isoDate(new Date())}

const statusLabel:Record<string,string>={
  planning:'Planejamento',
  active:'Ativo',
  paused:'Pausado',
  review:'Revisão',
  completed:'Concluído',
  cancelled:'Cancelado',
}

export function AdminReports(){
  const toast=useToast()
  const [startDate,setStartDate]=useState(startOfMonth())
  const [endDate,setEndDate]=useState(today())
  const [report,setReport]=useState<OperationalReport|null>(null)
  const [loading,setLoading]=useState(true)

  async function load(){
    try{
      setLoading(true)
      setReport(await reportsApi.operational(startDate,endDate))
    }catch(error:any){toast(error.message||'Não foi possível gerar o relatório.','error')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const maxSales=useMemo(()=>Math.max(1,...(report?.sales_by_month||[]).map(item=>Number(item.total)||0)),[report])
  const quoteRate=report?.summary.quotes
    ?Math.round((report.summary.accepted_quotes/report.summary.quotes)*100)
    :0

  function exportCsv(){
    if(!report)return
    const lines=[
      ['Relatório operacional',startDate+' a '+endDate],
      [],
      ['Indicador','Valor'],
      ['Novos clientes',String(report.summary.new_customers)],
      ['Pedidos',String(report.summary.orders)],
      ['Valor em pedidos',money(report.summary.orders_total)],
      ['Receita recebida',money(report.summary.paid_revenue)],
      ['Receita pendente',money(report.summary.pending_revenue)],
      ['Ticket médio',money(report.summary.avg_order_ticket)],
      ['Orçamentos',String(report.summary.quotes)],
      ['Orçamentos aceitos',String(report.summary.accepted_quotes)],
      ['Projetos concluídos',String(report.summary.projects_completed)],
      ['Projetos atrasados',String(report.summary.projects_overdue)],
      ['Tarefas concluídas',String(report.summary.tasks_completed)],
      ['Tarefas atrasadas',String(report.summary.tasks_overdue)],
      [],
      ['Itens mais vendidos','Quantidade','Total'],
      ...report.top_items.map(item=>[item.name,String(item.quantity),money(item.total)]),
      [],
      ['Produtividade','Concluídas','Atrasadas'],
      ...report.task_productivity.map(item=>[item.assignee,String(item.completed),String(item.overdue)]),
    ]
    const csv=lines.map(row=>row.map(cell=>'"'+String(cell??'').split('"').join('""')+'"').join(';')).join('\n')
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download='play-moments-relatorio-'+startDate+'-'+endDate+'.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const cards=report?[
    ['Receita recebida',money(report.summary.paid_revenue),'Entradas confirmadas no período'],
    ['Receita pendente',money(report.summary.pending_revenue),'Pagamentos ainda não confirmados'],
    ['Pedidos',String(report.summary.orders),money(report.summary.orders_total)+' em pedidos'],
    ['Ticket médio',money(report.summary.avg_order_ticket),'Média dos pedidos não cancelados'],
    ['Novos clientes',String(report.summary.new_customers),'Cadastros no período'],
    ['Conversão de orçamento',quoteRate+'%',report.summary.accepted_quotes+' de '+report.summary.quotes+' aceitos'],
    ['Projetos concluídos',String(report.summary.projects_completed),report.summary.projects_overdue+' projeto(s) atrasado(s)'],
    ['Tarefas concluídas',String(report.summary.tasks_completed),report.summary.tasks_overdue+' tarefa(s) atrasada(s)'],
  ]:[]

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#E30613] font-semibold">Gestão</p>
        <h1 className="text-2xl font-bold mt-1">Relatórios Operacionais</h1>
        <p className="text-sm text-gray-500 mt-1">Vendas, financeiro, projetos e produtividade em uma única visão.</p>
      </div>
      <button disabled={!report} onClick={exportCsv} className="min-h-11 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold disabled:opacity-40">Exportar CSV</button>
    </div>

    <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 mb-5">
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label className="text-xs text-gray-500">De
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
        </label>
        <label className="text-xs text-gray-500">Até
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
        </label>
        <button onClick={()=>void load()} disabled={loading||!startDate||!endDate} className="min-h-11 px-4 rounded-xl bg-[#E30613] text-white text-sm font-semibold disabled:opacity-40">{loading?'Gerando...':'Atualizar relatório'}</button>
      </div>
    </div>

    {loading&&!report?<div className="py-16 text-center text-sm text-gray-500">Gerando relatório...</div>:report&&<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(([label,value,detail])=><div key={label} className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-xl sm:text-2xl font-bold mt-2">{value}</p>
          <p className="text-[10px] text-gray-600 mt-1">{detail}</p>
        </div>)}
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mt-6">
        <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="mb-5">
            <h2 className="font-semibold">Vendas por mês</h2>
            <p className="text-xs text-gray-500">Valor dos pedidos não cancelados no período.</p>
          </div>
          {(report.sales_by_month||[]).length===0?<p className="text-sm text-gray-600">Sem vendas no período.</p>:<div className="space-y-4">
            {report.sales_by_month.map(item=><div key={item.month}>
              <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                <span>{item.month}</span>
                <span className="font-semibold">{money(item.total)} · {item.orders} pedido(s)</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-[#E30613]" style={{width:Math.max(3,Math.round((Number(item.total)||0)/maxSales*100))+'%'}}/></div>
            </div>)}
          </div>}
        </section>

        <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="mb-4">
            <h2 className="font-semibold">Situação dos projetos</h2>
            <p className="text-xs text-gray-500">Distribuição atual da carteira de projetos.</p>
          </div>
          <div className="space-y-2">
            {(report.project_statuses||[]).map(item=><div key={item.status} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.035]">
              <span className="text-sm">{statusLabel[item.status]||item.status}</span>
              <span className="text-sm font-bold">{item.count}</span>
            </div>)}
          </div>
        </section>

        <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="mb-4">
            <h2 className="font-semibold">Itens mais vendidos</h2>
            <p className="text-xs text-gray-500">Produtos, serviços e pacotes presentes nos pedidos.</p>
          </div>
          {(report.top_items||[]).length===0?<p className="text-sm text-gray-600">Nenhum item vendido no período.</p>:<div className="space-y-2">
            {report.top_items.map((item,index)=><div key={item.name} className="grid grid-cols-[24px_1fr_auto] gap-3 items-center p-3 rounded-xl bg-white/[0.035]">
              <span className="text-[10px] text-gray-600">#{index+1}</span>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-[10px] text-gray-500">{item.quantity} unidade(s)</p></div>
              <span className="text-xs font-semibold">{money(item.total)}</span>
            </div>)}
          </div>}
        </section>

        <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="mb-4">
            <h2 className="font-semibold">Produtividade da equipe</h2>
            <p className="text-xs text-gray-500">Tarefas concluídas no período e atrasadas atualmente.</p>
          </div>
          {(report.task_productivity||[]).length===0?<p className="text-sm text-gray-600">Sem tarefas atribuídas.</p>:<div className="space-y-2">
            {report.task_productivity.map(item=><div key={item.assignee} className="p-3 rounded-xl bg-white/[0.035]">
              <div className="flex justify-between gap-3"><span className="text-sm font-medium truncate">{item.assignee}</span><span className="text-xs text-emerald-400">{item.completed} concluída(s)</span></div>
              {item.overdue>0&&<p className="text-[10px] text-orange-400 mt-1">{item.overdue} atrasada(s)</p>}
            </div>)}
          </div>}
        </section>
      </div>
    </>}
  </div>
}
