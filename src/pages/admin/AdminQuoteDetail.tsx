import { useEffect,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { useToast } from '../../contexts/ToastContext'
import { rotulo,statusOrcamento } from '../../lib/labels.ptBR'

const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100)

export function AdminQuoteDetail(){
  const {id=''}=useParams()
  const navigate=useNavigate()
  const toast=useToast()
  const [quote,setQuote]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [item,setItem]=useState({description:'',quantity:1,unit_price:''})

  const load=async()=>{
    try{setQuote(await portalApi.quote(id))}
    finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[id])

  async function addItem(e:React.FormEvent){
    e.preventDefault()
    if(!item.description.trim()||!item.unit_price)return
    try{
      setBusy(true)
      const cents=Math.round(Number(item.unit_price.replace(',','.'))*100)
      await portalApi.saveQuoteItem({
        quote_id:id,
        description:item.description.trim(),
        quantity:Number(item.quantity)||1,
        unit_price:cents,
        total_price:cents*(Number(item.quantity)||1),
      })
      setItem({description:'',quantity:1,unit_price:''})
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setBusy(false)}
  }

  async function setStatus(status:string){
    try{
      setBusy(true)
      await portalApi.updateQuote(id,{status})
      toast(status==='sent'?'Orçamento enviado para o cliente.':'Orçamento atualizado.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
    finally{setBusy(false)}
  }

  async function convert(){
    try{
      setBusy(true)
      const result=await portalApi.convertQuote(id,true)
      toast(result.already_converted?'Este orçamento já foi convertido.':'Pedido e projeto criados.','success')
      if(result.order_id)navigate('/admin/pedidos/'+result.order_id)
    }catch(error:any){toast(error.message,'error')}
    finally{setBusy(false)}
  }

  if(loading)return <p className="text-gray-400">Carregando...</p>
  if(!quote)return <div>Orçamento não encontrado. <Link to="/admin/orcamentos" className="text-[#E30613]">Voltar</Link></div>

  return <div>
    <Link to="/admin/orcamentos" className="text-sm text-[#E30613]">← Orçamentos</Link>
    <div className="flex flex-wrap justify-between gap-4 mt-4">
      <div>
        <p className="font-bold text-[#E30613]">{quote.quote_number}</p>
        <h1 className="text-2xl font-bold">{quote.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{quote.customer?.first_name} {quote.customer?.last_name} · {quote.customer?.email}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Status</p>
        <p className="font-semibold">{rotulo(statusOrcamento,quote.status)}</p>
      </div>
    </div>

    <div className="grid lg:grid-cols-[1fr_320px] gap-5 mt-6">
      <section className="space-y-4">
        <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <h2 className="font-bold">Itens</h2>
          <form onSubmit={addItem} className="grid md:grid-cols-[1fr_100px_140px_auto] gap-2 mt-4">
            <input value={item.description} onChange={e=>setItem({...item,description:e.target.value})} placeholder="Descrição do item" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
            <input type="number" min="1" value={item.quantity} onChange={e=>setItem({...item,quantity:Number(e.target.value)})} className="px-3 py-2 rounded-xl bg-black border border-white/10"/>
            <input value={item.unit_price} onChange={e=>setItem({...item,unit_price:e.target.value})} placeholder="Valor R$" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
            <button disabled={busy} className="px-4 py-2 rounded-xl bg-[#E30613]">Adicionar</button>
          </form>
          <div className="mt-4">{quote.items?.length?quote.items.map((row:any)=><div key={row.id} className="flex justify-between gap-4 py-3 border-b border-white/5">
            <div><p>{row.description}</p><p className="text-xs text-gray-500">{row.quantity} × {money(row.unit_price)}</p></div>
            <div className="text-right"><b>{money(row.total_price)}</b><button onClick={async()=>{if(window.confirm('Excluir este item?')){await portalApi.deleteQuoteItem(row.id);await load()}}} className="block ml-auto text-xs text-red-400 mt-1">Excluir</button></div>
          </div>):<p className="text-sm text-gray-500 mt-4">Nenhum item adicionado.</p>}</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <h2 className="font-bold">Descrição</h2>
          <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{quote.description||'Sem descrição.'}</p>
          {quote.notes&&<><h3 className="font-semibold mt-5">Observações</h3><p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{quote.notes}</p></>}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="flex justify-between"><span>Total</span><b>{money(quote.total)}</b></div>
          {quote.valid_until&&<p className="text-xs text-gray-500 mt-2">Válido até {new Date(quote.valid_until+'T12:00').toLocaleDateString('pt-BR')}</p>}
          <div className="space-y-2 mt-5">
            {quote.status==='draft'&&<button disabled={busy||!quote.items?.length} onClick={()=>setStatus('sent')} className="w-full px-3 py-2 rounded-xl bg-[#E30613] disabled:opacity-40">Enviar ao cliente</button>}
            {quote.status==='accepted'&&!quote.converted_order_id&&<button disabled={busy} onClick={convert} className="w-full px-3 py-2 rounded-xl bg-green-600">Gerar pedido + projeto</button>}
            {quote.converted_order_id&&<Link to={'/admin/pedidos/'+quote.converted_order_id} className="block text-center px-3 py-2 rounded-xl bg-white/5">Abrir pedido gerado</Link>}
            {quote.converted_project_id&&<Link to={'/admin/projetos/'+quote.converted_project_id} className="block text-center px-3 py-2 rounded-xl bg-white/5">Abrir projeto gerado</Link>}
          </div>
        </div>
      </aside>
    </div>
  </div>
}
