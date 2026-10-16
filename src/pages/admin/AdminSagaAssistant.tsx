import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
type Event={id:string;event_type:string;title:string;message:string;status:string;created_at:string}
type Settings={enabled:boolean;internal_notifications:boolean;whatsapp_notifications:boolean;digest_times:string[]}
export function AdminSagaAssistant(){
 const [tab,setTab]=useState<'events'|'reports'|'settings'>('events')
 const [events,setEvents]=useState<Event[]>([])
 const [cfg,setCfg]=useState<Settings|null>(null)
 const [times,setTimes]=useState('')
 const [internal,setInternal]=useState(true)
 const [error,setError]=useState('')
 const [saving,setSaving]=useState(false)
 async function load(){
  const [a,b]=await Promise.all([
   supabase.from('sagamente_assistant_events').select('id,event_type,title,message,status,created_at').order('created_at',{ascending:false}).limit(100),
   supabase.from('sagamente_assistant_settings').select('enabled,internal_notifications,whatsapp_notifications,digest_times').eq('id',true).single()
  ])
  if(a.error||b.error){setError(a.error?.message||b.error?.message||'Consulta indisponível');return}
  setEvents((a.data||[]) as Event[])
  const row=b.data as Settings
  setCfg(row);setInternal(row.internal_notifications);setTimes((row.digest_times||[]).join(', '))
 }
 useEffect(()=>{void load()},[])
 async function save(){
  setSaving(true);setError('')
  const hours=times.split(',').map(t=>t.trim()).filter(Boolean)
  if(hours.length>6||hours.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||new Set(hours).size!==hours.length){
   setError('Use até seis horários únicos no formato HH:MM.');setSaving(false);return
  }
  const {error}=await supabase.from('sagamente_assistant_settings')
   .update({digest_times:hours,internal_notifications:internal,updated_at:new Date().toISOString()}).eq('id',true)
  if(error)setError(error.message)
  else await load()
  setSaving(false)
 }
 const rows=tab==='reports'?events.filter(e=>e.event_type==='daily_digest'):events
 return <div className="mx-auto max-w-5xl space-y-5 pb-10">
  <header><p className="text-xs text-[#DFA269]">Assistente Sagamente</p>
   <h1 className="text-2xl font-bold text-white">Saga</h1>
   <p className="text-sm text-gray-400">Gestão de eventos e resumos para Felipe.</p></header>
  <div className="rounded-xl border border-white/10 bg-[#161618] p-4 text-sm text-gray-300">
   Estado: {cfg?.enabled?'Ativo':'Desativado'} · WhatsApp Saga: {cfg?.whatsapp_notifications?'Configurado':'Desligado'}
  </div>
  <nav className="flex flex-wrap gap-2" aria-label="Navegação Saga">
   {([['events','Eventos'],['reports','Relatórios diários'],['settings','Configurações']] as const).map(([key,label])=>
    <button key={key} onClick={()=>setTab(key)} aria-pressed={tab===key}
     className={'rounded-xl px-4 py-3 text-sm '+(tab===key?'bg-[#A65A2A] text-white':'border border-white/10 text-gray-300')}>{label}</button>)}
  </nav>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  {tab==='settings'?<section className="space-y-4 rounded-xl border border-white/10 bg-[#161618] p-4">
   <h2 className="font-semibold">Preferências</h2>
   <label className="flex gap-3 text-sm"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Avisos internos (após ativação)</label>
   <label className="block space-y-2 text-sm">Horários dos resumos (HH:MM, separados por vírgula)
    <input className="block w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white" value={times} onChange={e=>setTimes(e.target.value)}/></label>
   <p className="text-xs text-gray-400">A ativação e os envios por WhatsApp não são controlados por esta tela.</p>
   <button disabled={!cfg||saving} onClick={()=>void save()} className="rounded-xl bg-[#A65A2A] px-5 py-3 text-sm text-white disabled:opacity-40">Salvar preferências</button>
  </section>:<section className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
   {rows.length?rows.map(row=><details key={row.id} className="bg-[#161618] p-4">
    <summary className="cursor-pointer text-sm text-white">{row.event_type==='daily_digest'?'Saga · Relatório diário':row.title}
     <span className="ml-2 text-xs text-gray-400">{new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · {row.status}</span></summary>
    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">{row.message}</p>
   </details>):<p className="bg-[#161618] p-4 text-sm text-gray-400">Sem registros. A Saga continua sem disparos automáticos.</p>}
  </section>}
 </div>
}
