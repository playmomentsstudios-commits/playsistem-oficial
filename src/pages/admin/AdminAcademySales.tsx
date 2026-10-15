import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {supabase} from '../../lib/supabase'
import {useToast} from '../../contexts/ToastContext'
type Price={
 work_id:string;ebook_cents:number;audiobook_cents:number;
 combo_cents:number;checkout_enabled:boolean;
}
type Work={id:string;release_code:string;title:string}
type Purchase={
 id:string;work_id:string;requested_format:string;
 amount_cents:number;status:string;provider:string;created_at:string;
 buyer_email:string;provider_capture_method:string|null;
}
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((cents||0)/100)
const field='min-h-10 w-full rounded-lg border border-white/15 bg-[#101114] px-3 text-xs text-white outline-none focus:border-[#d17b48]'
export function AdminAcademySales(){
 const toast=useToast()
 const [prices,setPrices]=useState<Price[]>([])
 const [works,setWorks]=useState<Work[]>([])
 const [orders,setOrders]=useState<Purchase[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [saving,setSaving]=useState<string|null>(null)
 const [activeTab,setActiveTab]=useState<'orders'|'prices'>('orders')
 async function load(){
  try{
   setLoading(true)
   const [p,w,o]=await Promise.all([
    supabase.from('academy_work_prices').select('work_id,ebook_cents,audiobook_cents,combo_cents,checkout_enabled'),
    supabase.from('academy_library_works').select('id,release_code,title').order('release_code'),
    supabase.from('academy_work_purchases').select('id,work_id,requested_format,amount_cents,status,provider,created_at,buyer_email,provider_capture_method').order('created_at',{ascending:false}).limit(300)
   ])
   if(p.error)throw p.error;if(w.error)throw w.error;if(o.error)throw o.error
   setPrices(p.data||[]);setWorks(w.data||[]);setOrders(o.data||[]);setError('')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar as vendas.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const title=(id:string)=>works.find(w=>w.id===id)
 const totals=useMemo(()=>({
  paid:orders.filter(x=>x.status==='fulfilled'||x.status==='paid_waiting_email'),
  pending:orders.filter(x=>x.status==='pending'||x.status==='creating'),
  verified:orders.filter(x=>x.status==='fulfilled')
 }),[orders])
 function setPrice(id:string,field:keyof Price,value:number|boolean){
  setPrices(rows=>rows.map(p=>p.work_id===id?{...p,[field]:value}:p))
 }
 async function save(p:Price){
  if(![p.ebook_cents,p.audiobook_cents,p.combo_cents].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=10000000))
   return toast('Defina preços em centavos válidos.','error')
  if(p.checkout_enabled&&!window.confirm('Habilitar checkout real para esta obra? Verifique antes a configuração da InfinitePay.'))return
  try{
   setSaving(p.work_id)
   const {error:failure}=await supabase.from('academy_work_prices').update({
    ebook_cents:p.ebook_cents,audiobook_cents:p.audiobook_cents,
    combo_cents:p.combo_cents,checkout_enabled:p.checkout_enabled,
    updated_at:new Date().toISOString()
   }).eq('work_id',p.work_id)
   if(failure)throw failure
   toast('Preços da obra atualizados.','success')
   await load()
  }catch(e){toast(e instanceof Error?e.message:'Falha ao salvar preços.','error')}
  finally{setSaving(null)}
 }
 return <div className="mx-auto max-w-7xl space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#d68f59]">Academia · Comercial</p>
    <h1 className="mt-1 text-2xl font-bold">Vendas Pix e preços</h1>
    <p className="mt-2 max-w-2xl text-xs leading-6 text-gray-400">Preços centralizados por obra. Os conteúdos são liberados somente após confirmação real da InfinitePay e verificação de e-mail.</p>
   </div>
   <Link to="/admin/academia" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-xs font-bold text-[#e6af81]">← Gestão da Academia</Link>
  </div>
  <div className="grid grid-cols-3 gap-3">{[
   ['Recebido',money(totals.paid.reduce((a,p)=>a+p.amount_cents,0))],
   ['Pagamentos pendentes',totals.pending.length],
   ['Acessos liberados',totals.verified.length]
  ].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-[#161719] p-4">
   <p className="text-xs text-gray-400">{label}</p><strong className="mt-2 block text-xl font-bold">{value}</strong>
  </div>)}</div>
  <div className="flex gap-2">{([['orders','Pedidos'],['prices','Preços e ativação']] as const).map(([key,label])=>
   <button type="button" aria-pressed={activeTab===key} key={key} onClick={()=>setActiveTab(key)}
    className={'min-h-10 rounded-xl px-4 text-xs font-bold '+(activeTab===key?'bg-[#b76e41] text-white':'border border-white/10 text-gray-300')}>{label}</button>)}</div>
  {error&&<p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
  {loading&&<p role="status" className="p-10 text-center text-sm text-gray-400">Carregando vendas...</p>}
  {!loading&&activeTab==='prices'&&<div className="space-y-3">
   <p className="text-xs leading-6 text-amber-200">A ativação de uma obra não configura sozinha as credenciais do checkout. É necessário habilitar o Checkout Integrado na InfinitePay e as variáveis seguras do backend; até lá, a página pública não faz cobranças.</p>
   {works.map(w=>{
    const p=prices.find(p=>p.work_id===w.id)
    if(!p)return null
    return <article key={w.id} className="rounded-2xl border border-white/10 bg-[#161719] p-4 sm:p-5">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] text-[#ddb088]">Release {w.release_code}</p><h2 className="mt-1 text-sm font-bold">{w.title}</h2></div>
      <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-200"><input type="checkbox" checked={p.checkout_enabled}
       onChange={e=>setPrice(w.id,'checkout_enabled',e.target.checked)} className="h-4 w-4 accent-[#c98252]"/> Ativar checkout</label>
     </div>
     <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {([['ebook_cents','E-book'],['audiobook_cents','Audiobook'],['combo_cents','Combo']] as const).map(([key,label])=>
       <label key={key} className="text-xs font-semibold text-gray-400">{label} · valor em centavos
        <input type="number" min={1} step={1} max={10000000} className={field+' mt-2'} value={p[key]}
         onChange={e=>setPrice(w.id,key,Number(e.target.value))}/>
        <span className="mt-1 block text-xs text-[#eab78e]">{money(p[key])}</span>
       </label>)}
     </div>
     <button type="button" disabled={saving===w.id} onClick={()=>void save(p)}
      className="mt-4 min-h-10 rounded-xl bg-[#af663b] px-5 text-xs font-bold text-white disabled:opacity-50">
      {saving===w.id?'Salvando...':'Salvar preços'}
     </button>
    </article>
   })}
  </div>}
  {!loading&&activeTab==='orders'&&<div className="space-y-3">
   {orders.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-gray-400">Nenhum pedido Pix ainda.</div>}
   {orders.map(order=><article key={order.id} className="rounded-2xl border border-white/10 bg-[#161719] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-[10px] uppercase tracking-widest text-[#dca071]">Release {title(order.work_id)?.release_code||'—'} · {order.requested_format}</p>
      <h3 className="mt-1 text-sm font-bold">{title(order.work_id)?.title||'Obra digital'}</h3>
      <p className="mt-2 text-xs text-gray-400">{order.buyer_email}</p>
      <p className="mt-1 text-[11px] text-gray-600">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
     </div>
     <div className="text-right"><strong className="text-lg tabular-nums">{money(order.amount_cents)}</strong>
      <p className="mt-2 text-xs text-[#dba77f]">{order.status==='fulfilled'?'Liberado':order.status==='paid_waiting_email'?'Pago · aguardando e-mail':order.status==='pending'?'Aguardando Pix':order.status==='creating'?'Criando checkout':order.status==='failed'?'Falhou':order.status}</p></div>
    </div>
   </article>)}
  </div>}
  <p className="text-[11px] text-gray-500">O painel mostra os últimos 300 pedidos. Não é possível marcar manualmente um Pix como pago nesta tela; a confirmação vem exclusivamente do provedor.</p>
 </div>
}
