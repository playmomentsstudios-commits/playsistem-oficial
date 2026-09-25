import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
export function NotificationsPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true)
 const load=()=>portalApi.notifications().then(setRows).finally(()=>setLoading(false))
 useEffect(()=>{void load(); const ch=window.setInterval(load,10000); return()=>clearInterval(ch)},[])
 const unread=rows.filter(n=>!n.read_at).length
 return <div><div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-bold text-white">Notificações</h1><p className="text-sm text-gray-500">{unread?unread+' não lida(s)':'Tudo em dia'}</p></div>{unread>0&&<button className="text-sm text-[#E30613]" onClick={async()=>{await portalApi.markAllNotifications();await load()}}>Marcar todas como lidas</button>}</div>
 {loading?<p className="text-gray-400">Carregando...</p>:!rows.length?<EmptyState icon="🔔" title="Nenhuma notificação"/>:<div className="space-y-2">{rows.map(n=><Link key={n.id} to={n.link||'#'} onClick={()=>!n.read_at&&portalApi.markNotification(n.id)} className="block p-4 rounded-2xl border" style={{background:n.read_at?'rgba(255,255,255,.03)':'rgba(227,6,19,.06)',borderColor:n.read_at?'rgba(255,255,255,.06)':'rgba(227,6,19,.2)'}}><div className="flex justify-between gap-4"><div><p className="font-semibold text-white">{n.title}</p><p className="text-sm text-gray-400">{n.message}</p><p className="text-xs text-gray-600 mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p></div>{!n.read_at&&<span className="w-2 h-2 rounded-full bg-[#E30613] mt-2"/>}</div></Link>)}</div>}</div>
}