import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
import { CompactPageHeader,CompactDisclosure } from '../../components/ui/CompactWorkspace'
export function AnnouncementsPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.announcements().then(setRows).finally(()=>setLoading(false))},[])
 return <div><CompactPageHeader title="Comunicados" description="Notícias e avisos da Sagamente." />{loading?<p>Carregando...</p>:!rows.length?<EmptyState icon="📢" title="Nenhum comunicado"/>:<div className="space-y-2">{rows.map(a=><CompactDisclosure key={a.id} title={a.title} summary={new Date(a.published_at).toLocaleDateString('pt-BR')}><p className="whitespace-pre-wrap text-xs leading-5 text-gray-300">{a.content}</p></CompactDisclosure>)}</div>}</div>
}