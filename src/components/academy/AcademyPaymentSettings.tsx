import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import type {AdminLibraryWork} from '../../api/academyLibraryAdmin'
const field='min-h-10 w-full rounded-lg border border-white/15 bg-[#101114] px-3 text-sm text-white'
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100)
const toCents=(raw:string)=>{
 const normalized=raw.trim().replace(',','.')
 return /^\d+(\.\d{1,2})?$/.test(normalized)?Math.round(Number(normalized)*100):null
}
type Format='ebook'|'audiobook'|'combo'
export function AcademyPaymentSettings({work,onChanged}:{work:AdminLibraryWork;onChanged?:()=>void}){
 const [prices,setPrices]=useState<Record<Format,string>>({ebook:'',audiobook:'',combo:''})
 const [handle,setHandle]=useState('')
 const [enabled,setEnabled]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [status,setStatus]=useState('')
 async function load(){
  const [a,b]=await Promise.all([
   supabase.from('academy_work_prices').select('format,price_cents,enabled').eq('work_id',work.id),
   supabase.from('academy_payment_settings').select('infinitepay_handle,infinitepay_enabled').eq('id',true).single()
  ])
  if(a.error)throw a.error
  if(b.error)throw b.error
  setPrices({
   ebook:a.data?.find(x=>x.format==='ebook')?.price_cents!=null?String(a.data.find(x=>x.format==='ebook')!.price_cents!/100):'',
   audiobook:a.data?.find(x=>x.format==='audiobook')?.price_cents!=null?String(a.data.find(x=>x.format==='audiobook')!.price_cents!/100):'',
   combo:a.data?.find(x=>x.format==='combo')?.price_cents!=null?String(a.data.find(x=>x.format==='combo')!.price_cents!/100):''
  })
  setHandle(b.data.infinitepay_handle||'');setEnabled(Boolean(b.data.infinitepay_enabled))
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[work.id])
 async function save(){
  setBusy(true);setError('');setStatus('')
  try{
   const rows=(['ebook','audiobook','combo'] as const).map(format=>{
    const price=prices[format].trim()?toCents(prices[format]):null
    if(prices[format].trim()&&(price===null||price<100))throw new Error('Informe valores a partir de R$ 1,00.')
    return {work_id:work.id,format,price_cents:price,enabled:price!==null,updated_at:new Date().toISOString()}
   })
   const tag=handle.trim().replace(/^\$/,'')
   if(tag&&!/^[\w.-]{3,80}$/.test(tag))throw new Error('InfiniteTag inválida.')
   if(enabled&&!tag)throw new Error('Informe a InfiniteTag antes de habilitar o Pix.')
   const a=await supabase.from('academy_work_prices').upsert(rows,{onConflict:'work_id,format'})
   if(a.error)throw a.error
   const b=await supabase.from('academy_payment_settings').update({
    infinitepay_handle:tag||null,infinitepay_enabled:enabled&&Boolean(tag),updated_at:new Date().toISOString()
   }).eq('id',true)
   if(b.error)throw b.error
   setStatus('Preços e conta InfinitePay salvos.');onChanged?.()
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar configurações.')}
  finally{setBusy(false)}
 }
 return <details className="rounded-xl border border-white/10 p-3">
  <summary className="cursor-pointer text-xs font-bold">Preços da obra e conta InfinitePay</summary>
  <p className="mt-3 text-xs leading-5 text-gray-400">Os valores começam vazios. Configure os preços reais do e-book, audiobook e combo, sem estimativas.</p>
  <div className="mt-3 grid grid-cols-3 gap-2">{(['ebook','audiobook','combo'] as const).map(format=><label key={format} className="text-xs text-gray-300">{format==='ebook'?'E-book':format==='audiobook'?'Audiobook':'Combo'} (R$)
   <input className={field+' mt-1'} inputMode="decimal" placeholder="Não definido" value={prices[format]} onChange={e=>setPrices(p=>({...p,[format]:e.target.value}))}/>
  </label>)}</div>
  <p className="mt-4 text-xs font-bold">InfiniteTag da sua conta InfinitePay</p>
  <input className={field+' mt-2'} value={handle} placeholder="Sua InfiniteTag, sem o símbolo $" onChange={e=>setHandle(e.target.value)}/>
  <label className="mt-3 flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Habilitar criação de cobranças InfinitePay</label>
  <p className="mt-2 text-[11px] leading-5 text-gray-500">Confira a InfiniteTag no aplicativo InfinitePay. Nunca use a chave Pix Nubank ou o gateway Asaas como se fossem desta conta.</p>
  <button type="button" disabled={busy} onClick={()=>void save()} className="mt-3 min-h-10 rounded-xl bg-[#a65a2a] px-4 text-xs font-bold text-white disabled:opacity-40">Salvar configurações</button>
  {error&&<p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
  {status&&<p role="status" className="mt-2 text-xs text-emerald-300">{status}</p>}
 </details>
}
