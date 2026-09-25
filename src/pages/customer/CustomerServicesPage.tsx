import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
import { rotulo,statusProjeto } from '../../lib/labels.ptBR'
export function CustomerServicesPage(){
 const [projects,setProjects]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.projects().then(p=>setProjects(p.filter((x:any)=>['service','design','website','audiovisual'].includes(x.project_type)))).finally(()=>setLoading(false))},[])
 return <div><h1 className="text-2xl font-bold text-white mb-2">Meus Serviços</h1><p className="text-sm text-gray-500 mb-6">Serviços contratados e em andamento</p>{loading?<p>Carregando...</p>:!projects.length?<EmptyState icon="⚡" title="Nenhum serviço contratado"/>:<div className="space-y-3">{projects.map(p=><div key={p.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10"><b>{p.title}</b><p className="text-sm text-gray-400 mt-1">{rotulo(statusProjeto,p.status)}</p>{p.due_date&&<p className="text-xs text-gray-500">Prazo {new Date(p.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}</div>)}</div>}</div>
}