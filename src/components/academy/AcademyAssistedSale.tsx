import {useEffect,useRef,useState} from 'react'
import {supabase} from '../../lib/supabase'
import type {AdminLibraryWork} from '../../api/academyLibraryAdmin'
import {AcademyPaymentSettings} from './AcademyPaymentSettings'
type Format='ebook'|'audiobook'|'combo'
type Method='gift'|'cash'|'infinitepay_pix'
type Sale={id:string;status:string;payment_method:Method;amount_cents:number;format:Format;created_at:string}
const input='min-h-11 w-full rounded-xl border border-white/15 bg-[#101114] px-3 text-sm text-white'
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100)
const cents=(v:string)=>{
 const s=v.trim().replace(',','.')
 return /^\d+(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):null
}
export function AcademyAssistedSale({
 work,customerId,format,onCompleted
}:{work:AdminLibraryWork;customerId:string;format:Format;onCompleted:()=>Promise<void>}){
 const [method,setMethod]=useState<Method>('gift')
 const [amount,setAmount]=useState('')
 const [note,setNote]=useState('')
 const [configured,setConfigured]=useState(false)
 const [tablePrice,setTablePrice]=useState<number|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [sales,setSales]=useState<Sale[]>([])
 const [pendingId,setPendingId]=useState('')
 const [checkout,setCheckout]=useState<{url:string;qr:string}|null>(null)
 const requestKey=useRef(crypto.randomUUID())
 async function load(){
  const [price,settings,history]=await Promise.all([
   supabase.from('academy_work_prices').select('price_cents,enabled').eq('work_id',work.id).eq('format',format).maybeSingle(),
   supabase.from('academy_payment_settings').select('infinitepay_enabled,infinitepay_handle').eq('id',true).single(),
   supabase.from('academy_work_sales').select('id,status,payment_method,amount_cents,format,created_at')
    .eq('work_id',work.id).order('created_at',{ascending:false}).limit(30)
  ])
  if(price.error)throw price.error
  if(settings.error)throw settings.error
  if(history.error)throw history.error
  const priceCents=price.data?.enabled?Number(price.data.price_cents):null
  setTablePrice(priceCents)
  setConfigured(Boolean(settings.data.infinitepay_enabled&&settings.data.infinitepay_handle))
  setSales((history.data||[]) as Sale[])
  return priceCents
 }
 useEffect(()=>{
  let alive=true
  void load().then(price=>{if(alive)setAmount(price!=null?(price/100).toFixed(2):'')}).catch(e=>{if(alive)setError(e.message)})
  return()=>{alive=false}
 },[work.id,format])
 async function startCheckout(saleId:string){
  try{
   setBusy(true);setError('')
   const {data,error:failure}=await supabase.functions.invoke('academy-infinitepay',{body:{sale_id:saleId}})
   if(failure||!data?.ok)throw new Error(data?.error||'Não foi possível gerar o checkout.')
   if(data.status==='completed'){await onCompleted();setPendingId('');setMessage('Pagamento confirmado e acesso liberado.');await load();return}
   const url=String(data.checkout_url||'')
   if(!url.startsWith('https://checkout.infinitepay.com.br/'))throw new Error('URL InfinitePay não validada.')
   setCheckout({url,qr:String(data.qr_data_url||'')})
   setPendingId(saleId)
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar a cobrança.')}
  finally{setBusy(false)}
 }
 async function save(){
  if(!customerId)return setError('Selecione o cliente.')
  const value=method==='gift'?0:cents(amount)
  if(value===null||(method!=='gift'&&value<100))return setError('Informe um valor válido, a partir de R$ 1,00.')
  if(method==='gift'&&note.trim().length<5)return setError('Informe o motivo da cortesia.')
  if(method!=='gift'&&tablePrice!==null&&value!==tablePrice&&note.trim().length<5)return setError('Justifique a diferença do preço negociado.')
  if(method==='infinitepay_pix'&&!configured)return setError('Configure sua InfiniteTag primeiro.')
  const prompt=method==='gift'
   ?'Registrar cortesia de R$ 0,00 e liberar este formato?'
   :method==='cash'
   ?'CONFIRMA QUE O DINHEIRO JÁ FOI RECEBIDO EM MÃOS? Esta ação registra receita e libera o conteúdo.'
   :'Criar cobrança Pix pendente? O conteúdo só será liberado após confirmação do pagamento pela InfinitePay.'
  if(!window.confirm(prompt))return
  try{
   setBusy(true);setError('');setMessage('')
   const {data,error:failure}=await supabase.rpc('academy_admin_create_sale',{
    p_work_id:work.id,p_customer_id:customerId,p_format:format,
    p_payment_method:method,p_amount_cents:value,p_note:note.trim()||null,
    p_request_key:requestKey.current
   })
   if(failure)throw failure
   const id=String(data)
   if(method==='infinitepay_pix'){
    setPendingId(id)
    // Keep the pending order even if payment link creation later fails.
    await startCheckout(id)
   }else{
    requestKey.current=crypto.randomUUID()
    setMessage(method==='gift'?'Cortesia registrada, acesso liberado sem receita.':'Dinheiro recebido, receita registrada e acesso liberado.')
    setNote('');await onCompleted()
   }
   await load()
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a operação.')}
  finally{setBusy(false)}
 }
 async function check(){
  if(!pendingId)return
  try{
   setBusy(true);setError('')
   const {data,error:failure}=await supabase.from('academy_work_sales').select('status').eq('id',pendingId).single()
   if(failure)throw failure
   if(data.status==='completed'){
    setPendingId('');setCheckout(null);requestKey.current=crypto.randomUUID()
    setMessage('Pix verificado pelo provedor e acesso liberado.');await onCompleted()
   }else setMessage('Ainda pendente na InfinitePay. O conteúdo não foi liberado.')
   await load()
  }catch(e){setError(e instanceof Error?e.message:'Falha ao conferir cobrança.')}
  finally{setBusy(false)}
 }
 const received=sales.filter(x=>x.status==='completed'&&x.payment_method!=='gift').reduce((sum,x)=>sum+x.amount_cents,0)
 return <section className="space-y-3 rounded-2xl border border-[#b97b4e]/25 bg-[#a65a2a]/[.04] p-4">
  <h4 className="text-sm font-bold">Liberação com registro financeiro</h4>
  <p className="text-xs leading-5 text-gray-400">Formatos: {format==='combo'?'E-book + Audiobook':format==='ebook'?'E-book':'Audiobook'} · Preço padrão: {tablePrice!==null?money(tablePrice):'Ainda não definido'}</p>
  <div className="grid grid-cols-3 gap-2">{([['gift','Gratuito'],['cash','Dinheiro em mãos'],['infinitepay_pix','Pix agora']] as const).map(([id,label])=>
   <button type="button" key={id} aria-pressed={method===id} className={'min-h-12 rounded-xl border px-1 text-[11px] font-bold '+(method===id?'border-[#e2a174] bg-[#5a3624] text-white':'border-white/10 text-gray-300')}
    onClick={()=>{setMethod(id);setError('')}}>{label}</button>)}</div>
  {method!=='gift'&&<label className="block text-xs text-gray-300">Valor negociado (R$)
   <input className={input+' mt-2'} inputMode="decimal" placeholder="19,90" value={amount} onChange={e=>setAmount(e.target.value)}/>
  </label>}
  <label className="block text-xs text-gray-300">{method==='gift'?'Motivo obrigatório da cortesia':'Observação / negociação'}
   <textarea className={input+' mt-2'} rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
  </label>
  {method==='infinitepay_pix'&&!configured&&<p className="text-xs text-amber-300">Pix indisponível até informar sua InfiniteTag na configuração abaixo.</p>}
  <button type="button" disabled={!customerId||busy||Boolean(pendingId)||(method==='infinitepay_pix'&&!configured)}
   onClick={()=>void save()} className="min-h-11 w-full rounded-xl bg-[#a65a2a] px-4 text-xs font-bold text-white disabled:opacity-30">
    {busy?'Processando...':method==='gift'?'Registrar cortesia e liberar':method==='cash'?'Confirmar recebimento e liberar':'Criar cobrança Pix InfinitePay'}
  </button>
  {error&&<p role="alert" className="rounded-lg border border-red-500/20 p-3 text-xs text-red-300">{error}</p>}
  {message&&<p role="status" className="rounded-lg border border-emerald-500/20 p-3 text-xs text-emerald-300">{message}</p>}
  {pendingId&&<div className="space-y-2 rounded-xl border border-amber-500/20 bg-black/20 p-3">
   <strong className="text-xs text-amber-200">Pagamento pendente — acesso não liberado</strong>
   {checkout?.qr&&<img className="mx-auto h-52 w-52 rounded-xl bg-white p-2" alt="QR para abrir o checkout InfinitePay" src={checkout.qr}/>}
   <p className="text-xs leading-5 text-gray-400">Escaneie o QR do checkout oficial e escolha Pix. Este QR abre a página de pagamento; não é o código Pix bancário.</p>
   {checkout&&<a className="block text-xs font-bold text-[#dba073] underline" href={checkout.url} target="_blank" rel="noopener noreferrer">Abrir checkout InfinitePay ↗</a>}
   <button type="button" disabled={busy} onClick={()=>void check()} className="min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold">Verificar confirmação</button>
   {!checkout&&<button type="button" disabled={busy} onClick={()=>void startCheckout(pendingId)} className="ml-2 min-h-10 rounded-xl border border-white/10 px-3 text-xs font-bold">Gerar checkout pendente</button>}
  </div>}
  <AcademyPaymentSettings work={work} onChanged={()=>{void load().then(p=>setAmount(p!=null?(p/100).toFixed(2):''))}}/>
  <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs font-bold">Histórico da obra · {sales.length} operações</summary>
   <p className="mt-2 text-xs text-gray-400">Receita confirmada: {money(received)}. Cortesias não somam receita.</p>
   <div className="mt-3 max-h-44 space-y-2 overflow-auto">{sales.map(s=><p key={s.id} className="text-[11px] text-gray-400">{new Date(s.created_at).toLocaleString('pt-BR')} · {s.payment_method==='gift'?'Cortesia':s.payment_method==='cash'?'Dinheiro':'Pix'} · {s.format} · {money(s.amount_cents)} · {s.status}</p>)}</div>
  </details>
 </section>
}
