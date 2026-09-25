import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
export function AnnouncementsPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.announcements().then(setRows).finally(()=>setLoading(false))},[])
 return <div><h1 className="text-2xl font-bold text-white mb-2">Comunicados</h1><p className="text-sm text-gray-500 mb-6">Atualizações da Play Moments</p>{loading?<p>Carregando...</p>:!rows.length?<EmptyState icon="📢" title="Nenhum comunicado"/>:<div className="space-y-3">{rows.map(a=><article key={a.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10"><h2 className="font-bold">{a.title}</h2><p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{a.content}</p><p className="text-xs text-gray-600 mt-3">{new Date(a.published_at).toLocaleString('pt-BR')}</p></article>)}</div>}</div>
}