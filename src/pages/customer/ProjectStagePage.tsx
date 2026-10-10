import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { projectProgress } from '../../lib/projectProgress'
import { rotulo, statusEtapa, statusTarefa } from '../../lib/labels.ptBR'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { LoadingState, ErrorState } from '../../components/ui/AsyncState'
import { ClientProjectFileCard } from '../../components/files/ClientProjectFileCard'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'

const byPosition=(a:any,b:any)=>(a.position||0)-(b.position||0)
const isCompleted=(task:any)=>task.status==='completed'

/**
 * One authenticated page per project stage. The existing project/file RLS policies
 * own authorization; this UI additionally honors stage/task/file visibility.
 * An arbitrary stage ID must never show data belonging to another project.
 */
export function ProjectStagePage(){
  const {id,stageId}=useParams()
  const location=useLocation()
  const adminView=location.pathname.startsWith('/admin/')
  const backTo=(adminView?'/admin/projetos/':'/app/projetos/')+id
  const [project,setProject]=useState<any|null>(null)
  const [files,setFiles]=useState<any[]>([])
  const [previewFile,setPreviewFile]=useState<any|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [warning,setWarning]=useState('')

  useEffect(()=>{
    let active=true
    setLoading(true)
    setError('')
    setWarning('')
    setProject(null)
    setFiles([])
    setPreviewFile(null)
    if(!id||!stageId){
      setLoading(false)
      return
    }
    Promise.allSettled([portalApi.project(id),portalApi.projectFiles(id)])
      .then(([detail,attachments])=>{
        if(!active)return
        if(detail.status==='rejected')throw detail.reason
        setProject(detail.value)
        if(attachments.status==='fulfilled')setFiles(attachments.value||[])
        else setWarning('As tarefas estão disponíveis, mas não foi possível carregar os arquivos desta etapa.')
      })
      .catch((cause:any)=>{if(active)setError(cause?.message||'Não foi possível carregar a etapa.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[id,stageId])

  const stage=useMemo(()=>project?.stages?.find((item:any)=>item.id===stageId&&item.project_id===id&&item.client_visible),[project,stageId,id])
  const tasks=useMemo(()=>[...(project?.tasks||[])]
    .filter((task:any)=>task.client_visible&&task.project_id===id&&task.stage_id===stageId)
    .sort(byPosition),[project,id,stageId])
  const stageFiles=useMemo(()=>{
    // The task association is authoritative for legacy files without stage_id;
    // newly uploaded files also carry stage_id directly.
    const linkedTasks=new Map<string,string>()
    for(const task of project?.tasks||[]){
      if(task.client_visible&&task.project_id===id&&task.id&&task.stage_id)linkedTasks.set(task.id,task.stage_id)
    }
    return files.filter((file:any)=>{
      if(!file.client_visible||file.project_id!==id)return false
      if(file.task_id&&linkedTasks.has(file.task_id))return linkedTasks.get(file.task_id)===stageId
      return file.stage_id===stageId
    })
  },[files,project,id,stageId])
  const done=tasks.filter(isCompleted).length
  const progress=projectProgress({tasks})

  if(loading)return <LoadingState />
  if(error)return <ErrorState message={error}/>
  if(!project||!stage)return <div className="pm-compact-card">
    <h1 className="text-base font-semibold text-white">Etapa indisponível</h1>
    <p className="mt-2 text-sm text-gray-400">Esta etapa não existe, não está liberada ou você não tem acesso ao projeto.</p>
    <Link to={backTo} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#DFA269]">Voltar ao projeto ↗</Link>
  </div>

  return <div className="pb-6 space-y-4">
    <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
    <section className="pm-compact-card" aria-label="Resumo da etapa">
      <CompactPageHeader title={stage.name} backTo={backTo} backLabel="Voltar ao projeto"
        eyebrow={adminView?'Prévia da área do cliente':'Acompanhamento da etapa'}
        actions={<span className={'pm-tag inline-flex items-center gap-1 whitespace-nowrap '+(
          stage.status==='completed'?'text-emerald-300':stage.status==='review'?'text-sky-300':'text-[#DFA269]')}>
          {rotulo(statusEtapa,stage.status)}
        </span>}>
        <div className="text-xs text-gray-400">{project.title}</div>
      </CompactPageHeader>
      {stage.description&&<p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">{stage.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[.08] pt-3">
        <span className="text-xs text-gray-300">Tarefas concluídas: <strong className="text-white">{done}/{tasks.length}</strong></span>
        <div role="progressbar" aria-label="Progresso da etapa" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tasks.length?progress:0}
          className="h-1.5 flex-1 min-w-[90px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#A65A2A]" style={{width:(tasks.length?progress:0)+'%'}}/>
        </div>
        <span className="text-xs text-gray-300">{tasks.length?progress+'%':'Aguardando tarefas'}</span>
      </div>
    </section>

    {warning&&<p role="status" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-200">{warning}</p>}

    <section aria-label="Arquivos desta etapa">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="pm-compact-section-title">Arquivos desta etapa <span className="text-gray-500">({stageFiles.length})</span></h2>
        <Link to={adminView?'/admin/arquivos':'/app/arquivos'} className="text-xs font-semibold text-[#DFA269]">Biblioteca de arquivos ↗</Link>
      </div>
      {stageFiles.length?<div className="pm-compact-card">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {stageFiles.map((file:any)=><ClientProjectFileCard key={file.id} file={file} onOpen={setPreviewFile} compact/>)}
        </div>
      </div>:<p className="pm-compact-card text-xs text-gray-400">Ainda não há arquivos liberados para visualização nesta etapa.</p>}
    </section>

    <section aria-label="Tarefas desta etapa">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="pm-compact-section-title">Tarefas desta etapa</h2>
        <span className="text-[11px] text-gray-500">{done} de {tasks.length} concluída(s)</span>
      </div>
      {tasks.length?<div className="space-y-2">
        {tasks.map((task:any)=><details key={task.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.025]">
          <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="min-w-0 font-semibold text-gray-100"><span className={'mr-2 '+(isCompleted(task)?'text-emerald-400':'text-amber-300')}>{isCompleted(task)?'✓':'○'}</span>{task.title}</span>
            <span className="text-[11px] text-gray-400">{rotulo(statusTarefa,task.status)} ▾</span>
          </summary>
          <div className="space-y-2 border-t border-white/10 px-3 py-3 text-xs">
            {task.description&&<p className="whitespace-pre-wrap text-gray-300">{task.description}</p>}
            {(task.checklist||[]).length>0&&<div>
              <p className="mb-1 font-semibold text-gray-300">Checklist</p>
              {[...task.checklist].sort(byPosition).map((item:any)=><p key={item.id} className={item.completed?'py-0.5 text-emerald-300':'py-0.5 text-gray-400'}>{item.completed?'✓':'○'} {item.title}</p>)}
            </div>}
            {(task.links||[]).filter((link:any)=>link.client_visible).length>0&&<div>
              <p className="mb-1 font-semibold text-gray-300">Links de visualização</p>
              <div className="flex flex-wrap gap-2">{task.links.filter((link:any)=>link.client_visible).map((link:any)=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="pm-compact-tap inline-flex items-center rounded-lg border border-[#A65A2A]/25 px-3 text-xs text-[#DFA269]">{link.label} ↗</a>)}</div>
            </div>}
          </div>
        </details>)}
      </div>:<p className="pm-compact-card text-xs text-gray-400">Nenhuma tarefa liberada nesta etapa.</p>}
    </section>
  </div>
}
