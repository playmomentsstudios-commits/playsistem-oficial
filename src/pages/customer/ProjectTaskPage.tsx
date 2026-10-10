import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { rotulo, statusTarefa } from '../../lib/labels.ptBR'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { LoadingState, ErrorState } from '../../components/ui/AsyncState'
import { ClientProjectFileCard } from '../../components/files/ClientProjectFileCard'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'

const byPosition=(a:any,b:any)=>(a.position||0)-(b.position||0)

/**
 * Authenticated task delivery: a task-status notice opens ONLY the task that
 * changed (with its own files and procedures), not every task in its stage.
 * Project RLS plus explicit project/stage/task visibility protect every lookup.
 */
export function ProjectTaskPage(){
  const { id,stageId,taskId }=useParams()
  const adminView=useLocation().pathname.startsWith('/admin/')
  const prefix=adminView?'/admin/projetos/':'/app/projetos/'
  const stageUrl=prefix+id+'/etapas/'+stageId
  const [project,setProject]=useState<any|null>(null)
  const [files,setFiles]=useState<any[]>([])
  const [previewFile,setPreviewFile]=useState<any|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [warning,setWarning]=useState('')

  useEffect(()=>{
    let active=true
    setLoading(true);setError('');setWarning('');setProject(null);setFiles([]);setPreviewFile(null)
    if(!id||!stageId||!taskId){setLoading(false);return}
    Promise.allSettled([portalApi.project(id),portalApi.projectFiles(id)])
      .then(([detail,attachments])=>{
        if(!active)return
        if(detail.status==='rejected')throw detail.reason
        setProject(detail.value)
        if(attachments.status==='fulfilled')setFiles(attachments.value||[])
        else setWarning('Os procedimentos estão disponíveis, mas não foi possível carregar os anexos desta tarefa.')
      })
      .catch((reason:any)=>{if(active)setError(reason?.message||'Não foi possível abrir a tarefa.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[id,stageId,taskId])

  const stage=useMemo(()=>project?.stages?.find((s:any)=>
    s.id===stageId&&s.project_id===id&&s.client_visible),[project,id,stageId])
  const task=useMemo(()=>stage&&project?.tasks?.find((t:any)=>
    t.id===taskId&&t.project_id===id&&t.stage_id===stageId&&t.client_visible),[project,stage,id,stageId,taskId])
  const attachments=useMemo(()=>files.filter((f:any)=>
    f.client_visible&&f.project_id===id&&f.task_id===taskId
    &&(!f.stage_id||f.stage_id===stageId)),[files,id,taskId,stageId])
  const checklist=useMemo(()=>[...(task?.checklist||[])].sort(byPosition),[task])
  const links=useMemo(()=>[...(task?.links||[])].filter((l:any)=>l.client_visible),[task])
  const complete=checklist.filter((item:any)=>item.completed).length
  const percent=checklist.length?Math.round(100*complete/checklist.length):(task?.status==='completed'?100:0)
  const statusClass=task?.status==='completed'?'text-emerald-300 border-emerald-500/30 bg-emerald-500/10':
    task?.status==='review'?'text-sky-300 border-sky-500/30 bg-sky-500/10':
    task?.status==='in_progress'?'text-amber-300 border-amber-500/30 bg-amber-500/10':
    'text-gray-300 border-white/15 bg-white/5'

  if(loading)return <LoadingState/>
  if(error)return <ErrorState message={error}/>
  if(!project||!stage||!task)return <div className="pm-compact-card">
    <h1 className="font-semibold text-white">Tarefa indisponível</h1>
    <p className="mt-2 text-sm text-gray-400">A tarefa não existe nesta etapa, não está liberada ou você não possui acesso.</p>
    <Link to={stageUrl} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#DFA269]">Voltar à etapa ↗</Link>
  </div>

  return <div className="pb-6 space-y-4">
    <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
    <section className="pm-compact-card" aria-label="Resumo desta tarefa">
      <CompactPageHeader title={task.title} backTo={stageUrl} backLabel="Voltar à etapa"
        eyebrow={adminView?'Prévia da tarefa para o cliente':'Acompanhamento desta tarefa'}
        actions={<span className={'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold '+statusClass}>{rotulo(statusTarefa,task.status)}</span>}>
        <p className="text-xs text-gray-400">{project.title} · {stage.name}</p>
      </CompactPageHeader>
      {task.description&&<p className="mt-3 text-sm text-gray-300 whitespace-pre-wrap">{task.description}</p>}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
        <span>{attachments.length} arquivo(s) disponível(is)</span>
        <span>·</span>
        <span>{complete} de {checklist.length} procedimentos concluídos</span>
        {task.due_date&&<><span>·</span><span>Prazo: {new Date(task.due_date.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR')}</span></>}
      </div>
    </section>

    {warning&&<p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{warning}</p>}
    <section aria-label="Arquivos desta tarefa">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="pm-compact-section-title">Arquivos desta tarefa ({attachments.length})</h2>
      </div>
      {attachments.length?<div className="pm-compact-card">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {attachments.map((file:any)=><ClientProjectFileCard key={file.id} file={file} compact onOpen={setPreviewFile}/>)}
        </div>
      </div>:<p className="pm-compact-card text-xs text-gray-400">Nenhum arquivo desta tarefa foi liberado para o cliente.</p>}
    </section>

    <section aria-label="Procedimentos desta tarefa">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="pm-compact-section-title">Procedimentos e checklist</h2>
        <span className="text-xs text-gray-400">{complete}/{checklist.length} concluídos</span>
      </div>
      <div className="pm-compact-card space-y-3">
        <div role="progressbar" aria-label="Progresso dos procedimentos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[#A65A2A]" style={{width:percent+'%'}}/>
        </div>
        {checklist.length?<div className="space-y-0.5">
          {checklist.map((item:any)=><div key={item.id} className="flex items-start gap-3 border-b border-white/[.05] py-2.5 last:border-b-0">
            <span aria-hidden="true" className={'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs '+(item.completed?'border-emerald-500/40 bg-emerald-500/15 text-emerald-300':'border-white/20 text-gray-400')}>{item.completed?'✓':'○'}</span>
            <span className={'text-sm leading-5 '+(item.completed?'text-gray-400':'text-gray-100')}>{item.title}</span>
            <span className={'ml-auto shrink-0 text-[10px] '+(item.completed?'text-emerald-300':'text-gray-500')}>{item.completed?'Concluído':'Pendente'}</span>
          </div>)}
        </div>:<p className="text-xs text-gray-400">Não há procedimentos cadastrados para esta tarefa.</p>}
      </div>
    </section>

    {links.length>0&&<section aria-label="Links desta tarefa">
      <h2 className="pm-compact-section-title mb-2">Links e entregas</h2>
      <div className="pm-compact-card flex flex-wrap gap-2">
        {links.map((l:any)=><a key={l.id} href={l.url} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-10 items-center rounded-xl border border-[#A65A2A]/30 px-3 text-xs font-medium text-[#DFA269] hover:bg-white/5">{l.label} ↗</a>)}
      </div>
    </section>}

    <div className="flex flex-wrap items-center gap-3 text-xs">
      <Link to={stageUrl} className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-gray-300 hover:bg-white/5">Ver todas as tarefas da etapa ↗</Link>
      <Link to={prefix+id} className="inline-flex min-h-10 items-center px-2 text-gray-400">Voltar ao projeto</Link>
    </div>
  </div>
}
