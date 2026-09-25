import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
import { rotulo,statusEtapa,statusProjeto,statusTarefa } from '../../lib/labels.ptBR'

function progress(project:any){
  const valid=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  if(!valid.length)return 0
  return Math.round(valid.filter((task:any)=>task.status==='completed').length/valid.length*100)
}

export function ProjectsPage(){
  const {id}=useParams()
  const [rows,setRows]=useState<any[]>([])
  const [project,setProject]=useState<any>(null)
  const [files,setFiles]=useState<any[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    if(id){
      Promise.all([portalApi.project(id),portalApi.projectFiles(id)])
        .then(([item,projectFiles])=>{setProject(item);setFiles(projectFiles)})
        .finally(()=>setLoading(false))
    }else{
      portalApi.projects().then(setRows).finally(()=>setLoading(false))
    }
  },[id])

  async function openFile(file:any){
    if(file.external_url){window.open(file.external_url,'_blank','noopener,noreferrer');return}
    if(file.storage_path){
      const url=await portalApi.fileUrl(file.storage_path)
      window.open(url,'_blank','noopener,noreferrer')
    }
  }

  const stages=useMemo(()=>[...(project?.stages||[])].filter((stage:any)=>stage.client_visible).sort((a:any,b:any)=>a.position-b.position),[project])
  const currentStage=stages.find((stage:any)=>stage.status==='in_progress')||stages.find((stage:any)=>stage.status==='pending')||stages.at(-1)
  const nextStage=currentStage?stages.find((stage:any)=>stage.position>currentStage.position&&stage.status!=='completed'):null

  if(loading)return <p className="text-gray-400">Carregando...</p>

  if(id){
    if(!project)return <div><p>Projeto não encontrado.</p><Link to="/app/projetos" className="text-[#E30613]">Voltar</Link></div>

    return <div>
      <Link to="/app/projetos" className="text-sm text-[#E30613]">← Meus projetos</Link>
      <div className="flex flex-wrap justify-between gap-4 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          <p className="text-gray-400 mt-2">{project.description}</p>
        </div>
        <span className="h-fit px-3 py-1 rounded-full bg-white/5 text-sm">{rotulo(statusProjeto,project.status)}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="md:col-span-2 p-5 rounded-2xl bg-[#141416] border border-white/10">
          <div className="flex justify-between"><span>Progresso</span><b>{progress(project)}%</b></div>
          <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 bg-[#E30613] rounded" style={{width:progress(project)+'%'}}/></div>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div><p className="text-xs text-gray-500">Etapa atual</p><p className="font-semibold mt-1">{currentStage?.name||'A definir'}</p></div>
            <div><p className="text-xs text-gray-500">Próxima etapa</p><p className="font-semibold mt-1">{nextStage?.name||'—'}</p></div>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-[#141416] border border-white/10 text-sm space-y-2">
          <p><span className="text-gray-500">Prazo:</span> {project.due_date?new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR'):'A definir'}</p>
          <p><span className="text-gray-500">Última atualização:</span> {new Date(project.updated_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {files.filter((file:any)=>!file.task_id).length>0&&<div className="mt-8">
        <h2 className="font-bold mb-3">Arquivos gerais do projeto</h2>
        <div className="flex flex-wrap gap-2">{files.filter((file:any)=>!file.task_id).map((file:any)=><button key={file.id} onClick={()=>openFile(file)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">{file.name} ↗</button>)}</div>
      </div>}

      <h2 className="font-bold mt-8 mb-3">Etapas e tarefas</h2>
      <div className="space-y-3">{stages.map((stage:any)=><div key={stage.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
        <div className="flex justify-between gap-3"><b>{stage.name}</b><span className="text-xs text-gray-500">{rotulo(statusEtapa,stage.status)}</span></div>
        <p className="text-sm text-gray-500 mt-1">{stage.description}</p>
        <div className="mt-3 space-y-3">{(project.tasks||[]).filter((task:any)=>task.stage_id===stage.id&&task.client_visible).map((task:any)=><div key={task.id} className="p-3 rounded-lg bg-black/20">
          <div className="flex justify-between gap-3"><p className="text-sm font-medium">{task.title}</p><span className="text-xs text-gray-500">{rotulo(statusTarefa,task.status)}</span></div>
          {task.description&&<p className="text-xs text-gray-500 mt-1">{task.description}</p>}
          {(task.checklist||[]).length>0&&<div className="mt-2 space-y-1">{task.checklist.sort((a:any,b:any)=>a.position-b.position).map((item:any)=><p key={item.id} className="text-xs text-gray-400">{item.completed?'✓':'○'} {item.title}</p>)}</div>}
          {(task.links||[]).filter((link:any)=>link.client_visible).length>0&&<div className="mt-2 flex flex-wrap gap-2">{task.links.filter((link:any)=>link.client_visible).map((link:any)=><a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="text-xs text-[#E30613] px-2 py-1 rounded bg-white/5">{link.label} ↗</a>)}</div>}
          {files.filter((file:any)=>file.task_id===task.id).length>0&&<div className="mt-2 flex flex-wrap gap-2">{files.filter((file:any)=>file.task_id===task.id).map((file:any)=><button key={file.id} onClick={()=>openFile(file)} className="text-xs text-[#E30613] px-2 py-1 rounded bg-white/5">{file.name} ↗</button>)}</div>}
        </div>)}</div>
      </div>)}</div>
    </div>
  }

  return <div>
    <h1 className="text-2xl font-bold text-white mb-2">Meus Projetos</h1>
    <p className="text-sm text-gray-500 mb-6">Acompanhe andamento, etapas e prazos</p>
    {!rows.length?<EmptyState icon="📈" title="Nenhum projeto ativo"/>:<div className="grid md:grid-cols-2 gap-4">{rows.map(project=><Link key={project.id} to={'/app/projetos/'+project.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10">
      <div className="flex justify-between gap-3"><b>{project.title}</b><span className="text-xs text-gray-400">{rotulo(statusProjeto,project.status)}</span></div>
      <p className="text-sm text-gray-500 mt-2">{progress(project)}% concluído</p>
      <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 bg-[#E30613] rounded" style={{width:progress(project)+'%'}}/></div>
      {project.due_date&&<p className="text-xs text-gray-500 mt-3">Prazo: {new Date(project.due_date+'T12:00').toLocaleDateString('pt-BR')}</p>}
    </Link>)}</div>}
  </div>
}
