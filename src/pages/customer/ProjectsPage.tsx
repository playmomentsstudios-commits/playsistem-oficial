import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { projectProgress } from '../../lib/projectProgress'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState,ErrorState } from '../../components/ui/AsyncState'
import { ProjectStatusMark } from '../../components/ui/SagamenteMotion'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'
import { ClientProjectFileCard } from '../../components/files/ClientProjectFileCard'
import { CompactPageHeader,CompactDisclosure } from '../../components/ui/CompactWorkspace'
import { rotulo,statusEtapa,statusProjeto,statusTarefa } from '../../lib/labels.ptBR'

const sortByPosition=(a:any,b:any)=>(a.position||0)-(b.position||0)
const formatDate=(date?:string|null)=>date?new Date(date.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'A definir'
const isComplete=(task:any)=>task.status==='completed'
export function ProjectsPage(){
  const {id}=useParams()
  const [rows,setRows]=useState<any[]>([])
  const [project,setProject]=useState<any>(null)
  const [files,setFiles]=useState<any[]>([])
  const [previewFile,setPreviewFile]=useState<any|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [warning,setWarning]=useState('')

  useEffect(()=>{
    let live=true
    setLoading(true)
    setError('')
    setWarning('')
    setPreviewFile(null)
    if(id){
      // A problem loading Drive files must never hide the project's progress.
      Promise.allSettled([portalApi.project(id),portalApi.projectFiles(id)])
        .then(([main,attachments])=>{
          if(!live)return
          if(main.status==='rejected')throw main.reason
          setProject(main.value)
          if(attachments.status==='fulfilled')setFiles((attachments.value||[]).filter((file:any)=>file.client_visible))
          else{
            setFiles([])
            setWarning('Não foi possível carregar os arquivos agora. O andamento do projeto continua disponível.')
          }
        })
        .catch((cause:any)=>{if(live)setError(cause?.message||'Não foi possível carregar o projeto.')})
        .finally(()=>{if(live)setLoading(false)})
    }else{
      portalApi.projects()
        .then(data=>{if(live)setRows(data)})
        .catch((cause:any)=>{if(live)setError(cause?.message||'Não foi possível carregar seus projetos.')})
        .finally(()=>{if(live)setLoading(false)})
    }
    return ()=>{live=false}
  },[id])

  const stages=useMemo(()=>[...(project?.stages||[])].filter((stage:any)=>stage.client_visible).sort(sortByPosition),[project])
  const tasks=useMemo(()=>{
    const visibleStageIds=new Set(stages.map((stage:any)=>stage.id))
    return [...(project?.tasks||[])].filter((task:any)=>
      task.client_visible&&(task.stage_id===null||visibleStageIds.has(task.stage_id)))
      .sort(sortByPosition)
  },[project,stages])
  const published=useMemo(()=>files.filter((file:any)=>file.client_visible),[files])
  const completed=useMemo(()=>tasks.filter(isComplete),[tasks])
  const remaining=useMemo(()=>tasks.filter((task:any)=>task.status!=='completed'&&task.status!=='cancelled'),[tasks])
  const percentage=useMemo(()=>projectProgress({tasks}),[tasks])
  const currentStage=stages.find((stage:any)=>stage.status==='in_progress')||stages.find((stage:any)=>stage.status==='pending')||stages.at(-1)
  const nextStage=currentStage?stages.find((stage:any)=>stage.position>currentStage.position&&stage.status!=='completed'):null
  const projectFiles=(taskId:string)=>published.filter((file:any)=>file.task_id===taskId)
  const openFile=(file:any)=>setPreviewFile(file)

  if(loading)return <LoadingState />
  if(error)return <ErrorState message={error} action={<button type="button" onClick={()=>window.location.reload()} className="min-h-11 px-4 rounded-xl bg-white/5">Tentar novamente</button>}/>

  if(id){
    if(!project)return <div><p>Projeto não encontrado.</p><Link to="/app/projetos" className="text-[#A65A2A]">Voltar</Link></div>

    return <div className="pb-6">
      <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
      <section className="pm-compact-card" aria-label="Resumo do projeto">
        <CompactPageHeader title={project.title} backTo="/app/projetos" backLabel="Meus projetos"
          actions={<span className="pm-tag pm-tag-progress inline-flex items-center gap-1 whitespace-nowrap"><ProjectStatusMark status={project.status}/>{rotulo(statusProjeto,project.status)}</span>}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-400">
            <span>Prazo: <strong className="text-gray-200">{formatDate(project.due_date)}</strong></span>
            <span>Etapa: <strong className="text-gray-200">{currentStage?.name||'A definir'}</strong></span>
            <span><strong className="text-gray-200">{published.length}</strong> arquivo(s) disponíveis</span>
            <a href="#arquivos-projeto" className="font-semibold text-[#DFA269] hover:underline">Ver artes ↘</a>
          </div>
        </CompactPageHeader>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[.08] pt-3">
          <div className="min-w-[110px] text-xs font-semibold text-gray-300">Progresso <span className="ml-1 text-white">{tasks.length?percentage+'%':'—'}</span></div>
          <div className="h-1.5 min-w-[95px] flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={tasks.length?percentage:0}>
            <div className="h-full rounded-full bg-[#A65A2A]" style={{width:(tasks.length?percentage:0)+'%'}}/>
          </div>
          <span className="text-[11px] text-emerald-300">{completed.length} concluída(s)</span>
          <span className="text-[11px] text-amber-200">{remaining.length} em aberto</span>
        </div>
        {!tasks.length&&<p className="mt-2 text-[11px] text-gray-500">O andamento será exibido quando houver tarefas liberadas.</p>}
      </section>

      {warning&&<p role="status" className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-200">{warning}</p>}

      <section id="arquivos-projeto" className="mt-4 scroll-mt-20" aria-label="Arquivos do projeto">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="pm-compact-section-title">Arquivos disponíveis do projeto</h2>
            <span className="text-xs text-gray-500">({published.length})</span>
          </div>
          <Link to="/app/arquivos" className="pm-compact-tap text-xs font-semibold text-[#DFA269] hover:underline">Biblioteca completa ↗</Link>
        </div>
        {published.length?<div className="pm-compact-card">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {published.map((file:any)=><ClientProjectFileCard key={file.id} file={file} onOpen={openFile} compact/>)}
          </div>
        </div>:<p className="pm-compact-card text-xs text-gray-400">Nenhum arquivo liberado para visualização ainda. As novas artes aparecerão aqui após publicação pela equipe.</p>}
      </section>

      <section className="mt-4" aria-label="Etapas e tarefas">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="pm-compact-section-title">Etapas e tarefas</h2>
          <span className="text-[11px] text-gray-500">{stages.length} etapa(s) · {tasks.length} tarefa(s)</span>
        </div>
        {stages.length===0?<p className="pm-compact-card text-xs text-gray-400">Nenhuma etapa liberada para acompanhamento.</p>:
          <div className="space-y-2">{stages.map((stage:any)=>{
            const stageTasks=tasks.filter((task:any)=>task.stage_id===stage.id)
            const stageComplete=stageTasks.filter(isComplete).length
            return <CompactDisclosure key={stage.id} title={stage.name}
              summary={<span>{rotulo(statusEtapa,stage.status)} · {stageComplete}/{stageTasks.length}</span>}
              defaultOpen={stage.status==='in_progress'}>
              {stage.description&&<p className="mb-2 whitespace-pre-wrap text-xs text-gray-400">{stage.description}</p>}
              {stageTasks.length>0?<div className="space-y-1.5">
                {stageTasks.map((task:any)=><details key={task.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-2.5 text-xs">
                    <span className="min-w-0 font-medium text-gray-100"><span className={isComplete(task)?'mr-2 text-emerald-400':'mr-2 text-amber-300'}>{isComplete(task)?'✓':'○'}</span>{task.title}</span>
                    <span className="text-[11px] text-gray-400">{rotulo(statusTarefa,task.status)} ▾</span>
                  </summary>
                  <div className="space-y-2 border-t border-white/10 px-3 pb-3 pt-2">
                    {task.description&&<p className="whitespace-pre-wrap text-xs text-gray-400">{task.description}</p>}
                    {(task.checklist||[]).length>0&&<div><p className="mb-1 text-[11px] font-semibold text-gray-300">Checklist de execução</p>
                      {[...task.checklist].sort(sortByPosition).map((item:any)=><p key={item.id} className={'py-0.5 text-xs '+(item.completed?'text-emerald-300':'text-gray-400')}>{item.completed?'✓':'○'} {item.title}</p>)}
                    </div>}
                    {(task.links||[]).filter((link:any)=>link.client_visible).length>0&&<div><p className="mb-1 text-[11px] font-semibold text-gray-300">Links de visualização</p><div className="flex flex-wrap gap-2">{task.links.filter((link:any)=>link.client_visible).map((link:any)=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="pm-compact-tap rounded-lg border border-[#A65A2A]/25 px-3 text-[11px] text-[#DFA269]">{link.label} ↗</a>)}</div></div>}
                    {projectFiles(task.id).length>0&&<div className="grid grid-cols-2 gap-2 md:grid-cols-3">{projectFiles(task.id).map((file:any)=><ClientProjectFileCard key={file.id} file={file} onOpen={openFile} compact/>)}</div>}
                  </div>
                </details>)}
              </div>:<p className="text-xs text-gray-500">Sem tarefas liberadas nesta etapa.</p>}
            </CompactDisclosure>
          })}</div>}
      </section>

      <div className="mt-3 space-y-2">
        {completed.length>0&&<CompactDisclosure title="Entregas concluídas" summary={completed.length+' concluída(s)'}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {completed.map((task:any)=><div key={task.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[.035] px-3 py-2 text-xs">
              <span className="text-emerald-300">✓</span><span className="min-w-0 truncate">{task.title}</span>
            </div>)}
          </div>
        </CompactDisclosure>}
        <CompactDisclosure title="Informações e histórico" summary="Descrição, atualização e próximas etapas">
          {project.description&&<p className="mb-2 whitespace-pre-wrap text-xs text-gray-400">{project.description}</p>}
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <p><span className="text-gray-500">Próxima etapa:</span> {nextStage?.name||'—'}</p>
            <p><span className="text-gray-500">Prazo:</span> {formatDate(project.due_date)}</p>
            <p><span className="text-gray-500">Última atualização:</span> {project.updated_at?new Date(project.updated_at).toLocaleString('pt-BR'):'—'}</p>
            <p><span className="text-gray-500">Arquivos liberados:</span> {published.length}</p>
          </div>
        </CompactDisclosure>
      </div>
    </div>
  }

  return <div className="pb-6">
    <CompactPageHeader title="Meus Projetos" description="Andamento, entregas e arquivos dos seus projetos." />
    {!rows.length?<EmptyState icon="📈" title="Nenhum projeto disponível"/>:<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map(item=>{
      const visibleStages=new Set((item.stages||[]).filter((stage:any)=>stage.client_visible).map((stage:any)=>stage.id))
      const listedTasks=(item.tasks||[]).filter((task:any)=>task.client_visible&&(!task.stage_id||visibleStages.has(task.stage_id)))
      const done=listedTasks.filter(isComplete).length
      const percent=projectProgress({tasks:listedTasks})
      return <Link key={item.id} to={'/app/projetos/'+item.id} className="pm-compact-card pm-compact-card-interactive block">
        <div className="flex flex-wrap justify-between gap-3"><b className="text-sm text-white">{item.title}</b><span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-gray-400"><ProjectStatusMark status={item.status}/>{rotulo(statusProjeto,item.status)}</span></div>
        <p className="text-[11px] text-gray-400 mt-2">{listedTasks.length?percent+'% concluído · '+done+' de '+listedTasks.length+' entregas concluídas':'Aguardando atualização das entregas'}</p>
        <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden"><div className="h-full bg-[#A65A2A] rounded-full" style={{width:(listedTasks.length?percent:0)+'%'}}/></div>
        {item.due_date&&<p className="text-[11px] text-gray-500 mt-2">Prazo: {formatDate(item.due_date)}</p>}
        <p className="text-[11px] font-semibold text-[#DFA269] mt-2">Ver detalhes e arquivos ↗</p>
      </Link>
    })}</div>}
  </div>
}
