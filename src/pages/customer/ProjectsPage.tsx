import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { projectProgress } from '../../lib/projectProgress'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState,ErrorState } from '../../components/ui/AsyncState'
import { FilePreviewModal } from '../../components/files/FilePreviewModal'
import { rotulo,statusEtapa,statusProjeto,statusTarefa } from '../../lib/labels.ptBR'

const sortByPosition=(a:any,b:any)=>(a.position||0)-(b.position||0)
const formatDate=(date?:string|null)=>date?new Date(date.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'A definir'
const isComplete=(task:any)=>task.status==='completed'
const kindIcon=(file:any)=>{
  const type=String(file.mime_type||file.file_type||'').toLowerCase()
  if(type.startsWith('image/'))return '🖼'
  if(type.includes('pdf'))return '▤'
  if(type.startsWith('video/'))return '▶'
  if(type.startsWith('audio/'))return '♫'
  return '↗'
}

function FileAction({file,onOpen}:{file:any;onOpen:(file:any)=>void}){
  return <button type="button" onClick={()=>onOpen(file)}
    className="inline-flex max-w-full items-center gap-2 min-h-10 px-3 py-2 rounded-xl border border-white/10 bg-white/[.045] text-left text-xs text-[#E1B18B] hover:border-[#A65A2A]/50 hover:bg-[#A65A2A]/10 transition-colors"
    aria-label={'Visualizar arquivo: '+file.name}>
    <span aria-hidden="true">{kindIcon(file)}</span>
    <span className="min-w-0 truncate">{file.name}</span>
    <span aria-hidden="true">↗</span>
  </button>
}

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

    return <div className="pb-10">
      <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)}/>
      <Link to="/app/projetos" className="inline-flex min-h-10 items-center text-sm text-[#DFA269] hover:underline">← Meus projetos</Link>
      <div className="flex flex-wrap justify-between gap-4 mt-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          {project.description&&<p className="text-sm text-gray-400 mt-2 leading-6 whitespace-pre-wrap">{project.description}</p>}
        </div>
        <span className="h-fit px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200">{rotulo(statusProjeto,project.status)}</span>
      </div>

      {warning&&<p role="status" className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-200">{warning}</p>}

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <section className="md:col-span-2 p-5 rounded-2xl bg-[#141416] border border-white/10" aria-label="Resumo do andamento">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-100">Andamento das entregas</h2>
            <b className="text-lg text-white">{tasks.length?percentage+'%':'—'}</b>
          </div>
          <div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <div className="h-full bg-[#A65A2A] rounded-full transition-[width]" style={{width:(tasks.length?percentage:0)+'%'}}/>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-emerald-500/[.07] border border-emerald-500/15 p-3">
              <p className="text-xs text-emerald-300">Entregas concluídas</p>
              <p className="text-xl font-bold text-emerald-300 mt-1">{completed.length}</p>
            </div>
            <div className="rounded-xl bg-amber-500/[.06] border border-amber-500/15 p-3">
              <p className="text-xs text-amber-200">Em aberto</p>
              <p className="text-xl font-bold text-amber-200 mt-1">{remaining.length}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div><p className="text-xs text-gray-500">Etapa atual</p><p className="text-sm font-semibold mt-1">{currentStage?.name||'A definir'}</p></div>
            <div><p className="text-xs text-gray-500">Próxima etapa</p><p className="text-sm font-semibold mt-1">{nextStage?.name||'—'}</p></div>
          </div>
          {!tasks.length&&<p className="mt-3 text-xs text-gray-400">Ainda não há tarefas liberadas para acompanhamento. O percentual aparecerá quando a equipe publicar as entregas.</p>}
        </section>
        <section className="p-5 rounded-2xl bg-[#141416] border border-white/10 text-sm space-y-3" aria-label="Prazos">
          <p><span className="text-gray-500">Prazo:</span> {formatDate(project.due_date)}</p>
          <p><span className="text-gray-500">Última atualização:</span> {project.updated_at?new Date(project.updated_at).toLocaleString('pt-BR'):'—'}</p>
          <p><span className="text-gray-500">Arquivos disponíveis:</span> {published.length}</p>
        </section>
      </div>

      {completed.length>0&&<section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="font-bold text-lg text-white">Entregas concluídas</h2>
          <span className="text-xs text-emerald-300">{completed.length} de {tasks.filter((task:any)=>task.status!=='cancelled').length} tarefas</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">{completed.map((task:any)=><article key={task.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.045] p-4">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold" aria-hidden="true">✓</span>
            <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-white">{task.title}</h3><p className="text-xs text-emerald-300 mt-1">Concluído</p></div>
          </div>
          {projectFiles(task.id).length>0&&<div className="mt-3 flex flex-wrap gap-2">{projectFiles(task.id).map((file:any)=><FileAction key={file.id} file={file} onOpen={openFile}/>)}</div>}
        </article>)}</div>
      </section>}

      <section className="mt-8">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h2 className="font-bold text-lg text-white">Arquivos disponíveis do projeto</h2>
          <span className="text-xs text-gray-400">{published.length} arquivo(s)</span>
        </div>
        {published.length?<div className="rounded-2xl border border-white/10 bg-[#141416] p-4">
          <p className="text-xs text-gray-400 mb-3">Clique em um arquivo para visualizar com acesso protegido ou baixar a versão disponível.</p>
          <div className="flex flex-wrap gap-2">{published.map((file:any)=><FileAction key={file.id} file={file} onOpen={openFile}/>)}</div>
        </div>:<p className="rounded-xl border border-white/10 bg-white/[.02] p-4 text-xs text-gray-400">A equipe ainda não liberou arquivos para visualização. Assim que forem publicados, aparecerão aqui.</p>}
        <Link to="/app/arquivos" className="inline-flex min-h-11 items-center mt-2 text-xs text-[#DFA269] hover:underline">Abrir biblioteca de arquivos ↗</Link>
      </section>

      <section className="mt-8">
        <h2 className="font-bold text-lg text-white mb-3">Etapas e tarefas</h2>
        {stages.length===0?<p className="rounded-xl border border-white/10 p-4 text-sm text-gray-400">Nenhuma etapa liberada para acompanhamento.</p>:
        <div className="space-y-3">{stages.map((stage:any)=>{
          const stageTasks=tasks.filter((task:any)=>task.stage_id===stage.id)
          const stageComplete=stageTasks.filter(isComplete).length
          return <article key={stage.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h3 className="font-semibold text-white">{stage.name}</h3><p className="text-xs text-gray-500 mt-1">{stage.description}</p></div>
              <div className="text-right"><span className={'text-xs '+(stage.status==='completed'?'text-emerald-300':'text-gray-400')}>{rotulo(statusEtapa,stage.status)}</span>
                {stageTasks.length>0&&<p className="text-xs text-gray-500 mt-1">{stageComplete}/{stageTasks.length} concluídas</p>}</div>
            </div>
            {stageTasks.length>0?<div className="mt-4 space-y-2">{stageTasks.map((task:any)=><details key={task.id} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden" open={false}>
              <summary className="cursor-pointer select-none p-3 flex flex-wrap justify-between items-center gap-3">
                <span className="text-sm font-semibold flex items-start gap-2">
                  <span className={isComplete(task)?'text-emerald-400':'text-amber-300'}>{isComplete(task)?'✓':'○'}</span>{task.title}
                </span>
                <span className={'text-xs '+(isComplete(task)?'text-emerald-300':'text-gray-400')}>{rotulo(statusTarefa,task.status)} · Detalhes ▾</span>
              </summary>
              <div className="px-3 pb-4 border-t border-white/5">
                {task.description&&<p className="text-xs text-gray-400 mt-3 whitespace-pre-wrap">{task.description}</p>}
                {(task.checklist||[]).length>0&&<div className="mt-3">
                  <p className="text-xs font-semibold text-gray-200 mb-2">Checklist de execução</p>
                  <div className="space-y-1">{[...task.checklist].sort(sortByPosition).map((item:any)=><div key={item.id} className={'text-xs flex gap-2 '+(item.completed?'text-emerald-300':'text-gray-400')}><span>{item.completed?'✓':'○'}</span>{item.title}</div>)}</div>
                </div>}
                {(task.links||[]).filter((link:any)=>link.client_visible).length>0&&<div className="mt-3">
                  <p className="text-xs font-semibold text-gray-200 mb-2">Links de visualização</p>
                  <div className="flex flex-wrap gap-2">{task.links.filter((link:any)=>link.client_visible).map((link:any)=><a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="min-h-9 inline-flex items-center px-3 rounded-lg border border-[#A65A2A]/25 text-xs text-[#DFA269]">{link.label} ↗</a>)}</div>
                </div>}
                {projectFiles(task.id).length>0&&<div className="mt-3">
                  <p className="text-xs font-semibold text-gray-200 mb-2">Arquivos desta tarefa</p>
                  <div className="flex flex-wrap gap-2">{projectFiles(task.id).map((file:any)=><FileAction key={file.id} file={file} onOpen={openFile}/>)}</div>
                </div>}
              </div>
            </details>)}</div>:<p className="text-xs text-gray-500 mt-3">A equipe ainda não liberou tarefas nesta etapa.</p>}
          </article>
        })}</div>}
      </section>
    </div>
  }

  return <div className="pb-10">
    <h1 className="text-2xl font-bold text-white mb-2">Meus Projetos</h1>
    <p className="text-sm text-gray-500 mb-6">Acompanhe entregas, tarefas, arquivos e prazos de cada projeto.</p>
    {!rows.length?<EmptyState icon="📈" title="Nenhum projeto disponível"/>:<div className="grid md:grid-cols-2 gap-4">{rows.map(item=>{
      const visibleStages=new Set((item.stages||[]).filter((stage:any)=>stage.client_visible).map((stage:any)=>stage.id))
      const listedTasks=(item.tasks||[]).filter((task:any)=>task.client_visible&&(!task.stage_id||visibleStages.has(task.stage_id)))
      const done=listedTasks.filter(isComplete).length
      const percent=projectProgress({tasks:listedTasks})
      return <Link key={item.id} to={'/app/projetos/'+item.id} className="p-5 rounded-2xl bg-[#141416] border border-white/10 hover:border-[#A65A2A]/40 transition-colors">
        <div className="flex flex-wrap justify-between gap-3"><b className="text-sm text-white">{item.title}</b><span className="text-xs text-gray-400">{rotulo(statusProjeto,item.status)}</span></div>
        <p className="text-xs text-gray-400 mt-3">{listedTasks.length?percent+'% concluído · '+done+' de '+listedTasks.length+' entregas concluídas':'Aguardando atualização das entregas'}</p>
        <div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-2 bg-[#A65A2A] rounded-full" style={{width:(listedTasks.length?percent:0)+'%'}}/></div>
        {item.due_date&&<p className="text-xs text-gray-500 mt-3">Prazo: {formatDate(item.due_date)}</p>}
        <p className="text-xs text-[#DFA269] mt-3">Ver detalhes e arquivos ↗</p>
      </Link>
    })}</div>}
  </div>
}
