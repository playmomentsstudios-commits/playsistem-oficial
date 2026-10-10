import { useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type PriorityEvent={
  event_key:string
  event_type:'payment_confirmed'|'project_created'|'project_completed'
  title:string
  message:string
  link:string
  created_at:string
}

const dateKey=(value:string)=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(value))

export function PriorityAlertHistory({phone,dailyLimit}:{phone:string;dailyLimit:number}){
  const [events,setEvents]=useState<PriorityEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  async function load(){
    setLoading(true)
    setError('')
    const {data,error:queryError}=await supabase.from('priority_alert_log')
      .select('event_key,event_type,title,message,link,created_at')
      .order('created_at',{ascending:false}).limit(40)
    if(queryError)setError('Não foi possível consultar o histórico de alertas.')
    else setEvents((data||[]) as PriorityEvent[])
    setLoading(false)
  }
  useEffect(()=>{void load()},[])
  const todayCount=useMemo(()=>{
    const today=dateKey(new Date().toISOString())
    return events.filter(event=>dateKey(event.created_at)===today).length
  },[events])
  function openWhatsApp(event:PriorityEvent){
    const digits=phone.replace(/\D/g,'')
    if(!/^55\d{10,11}$/.test(digits))return
    const message='SAGAMENTE — '+event.title+'\n\n'+event.message+
      '\n\nAcompanhar: '+window.location.origin+event.link
    window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer')
  }
  return <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">Histórico dos alertas</h3>
        <p className="text-xs text-gray-500 mt-1">{todayCount} de {dailyLimit} alertas registrados hoje · horário de Brasília</p>
      </div>
      <button type="button" onClick={()=>void load()} disabled={loading}
        className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-gray-300 disabled:opacity-50">Atualizar</button>
    </div>
    {error&&<p className="mt-3 text-xs text-red-300">{error}</p>}
    {loading?<p className="mt-4 text-xs text-gray-500">Carregando alertas...</p>:
      !events.length?<p className="mt-4 text-xs text-gray-500">Nenhum alerta prioritário registrado até agora. O histórico começa com os próximos eventos.</p>:
      <ul className="mt-3 divide-y divide-white/10">
        {events.slice(0,12).map(event=><li key={event.event_key} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{event.title}</p>
            <p className="mt-1 text-xs text-gray-400">{event.message}</p>
            <p className="mt-1 text-[11px] text-gray-600">{new Date(event.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={event.link} className="inline-flex min-h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-gray-300">Abrir</Link>
            <button type="button" onClick={()=>openWhatsApp(event)} disabled={!/^55\d{10,11}$/.test(phone)}
              className="min-h-9 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-300 disabled:opacity-40">WhatsApp manual ↗</button>
          </div>
        </li>)}
      </ul>}
  </div>
}
