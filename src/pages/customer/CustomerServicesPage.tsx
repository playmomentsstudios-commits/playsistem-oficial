import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
import { rotulo,statusProjeto } from '../../lib/labels.ptBR'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { Link } from 'react-router-dom'
export function CustomerServicesPage(){
 const [projects,setProjects]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.projects().then(p=>setProjects(p.filter((x:any)=>['service','design','website','audiovisual'].includes(x.project_type)))).finally(()=>setLoading(false))},[])
 return <div><CompactPageHeader title="Meus Serviços" description="Contratações e execução em andamento." />{loading?<p>Carregando...</p>:!projects.length?<EmptyState icon="⚡" title="Nenhum serviço contratado"/>:<div className="grid gap-2 md:grid-cols-2">{projects.map(p=><Link key={p.id} to={'/app/projetos/'+p.id} className="pm-compact-card pm-compact-card-interactive block"><b>{p.title}</b><p className="text-sm text-gray-400 mt-1">{rotulo(statusProjeto,p.status)}</p>{p.due_date&&<p className="text-xs text-gray-500">Prazo {new Date(p.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}</Link>)}</div>}</div>
}