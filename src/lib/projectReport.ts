function esc(value:unknown){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))
}
function date(value?:string|null){
  if(!value)return '—'
  const raw=value.length===10?value+'T12:00:00':value
  const parsed=new Date(raw)
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')
}
function status(value?:string){
  return ({planning:'Planejamento',active:'Em andamento',paused:'Pausado',review:'Em revisão',completed:'Concluído',cancelled:'Cancelado',pending:'Pendente',in_progress:'Em andamento'} as Record<string,string>)[value||'']||value||'—'
}
function priority(value?:string){
  return ({low:'Baixa',medium:'Média',high:'Alta',urgent:'Urgente'} as Record<string,string>)[value||'']||value||'—'
}
function projectProgress(project:any){
  const tasks=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  const checklist=tasks.flatMap((task:any)=>task.checklist||[])
  if(checklist.length)return Math.round(checklist.filter((item:any)=>item.completed).length/checklist.length*100)
  return tasks.length?Math.round(tasks.filter((task:any)=>task.status==='completed').length/tasks.length*100):0
}
function rows(project:any,team:any[]){
  const stages=project?.stages||[]
  return (project?.tasks||[]).flatMap((task:any)=>{
    const stage=stages.find((item:any)=>item.id===task.stage_id)
    const member=team.find((item:any)=>item.id===task.assigned_to)
    const owner=member?[member.first_name,member.last_name].filter(Boolean).join(' '):'Sem responsável'
    const checklist=task.checklist||[]
    if(!checklist.length)return [{stage:stage?.name||'Sem etapa',task:task.title,taskStatus:status(task.status),priority:priority(task.priority),owner,due:date(task.due_date),check:'—',checkStatus:'—'}]
    return checklist.sort((a:any,b:any)=>(a.position||0)-(b.position||0)).map((item:any)=>({stage:stage?.name||'Sem etapa',task:task.title,taskStatus:status(task.status),priority:priority(task.priority),owner,due:date(task.due_date),check:item.title,checkStatus:item.completed?'Concluído':'Pendente'}))
  })
}
function filename(project:any,suffix:string){
  const base=String(project?.title||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()
  return 'relatorio-'+base+'-'+new Date().toISOString().slice(0,10)+suffix
}
export function exportProjectReportSpreadsheet(project:any,team:any[]){
  const reportRows=rows(project,team)
  const summary=[
    ['Projeto',project.title],['Status',status(project.status)],['Prioridade',priority(project.priority)],
    ['Progresso',projectProgress(project)+'%'],['Início',date(project.start_date)],['Prazo',date(project.due_date)],
    ['Gerado em',new Date().toLocaleString('pt-BR')],['Objetivo / descrição',project.description||'Sem descrição.']
  ]
  const table=(data:any[][])=>'<table border="1">'+data.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</table>'
  const details=[['Etapa','Tarefa','Status da tarefa','Prioridade','Responsável','Prazo','Checklist / microtarefa','Situação'],...reportRows.map(r=>[r.stage,r.task,r.taskStatus,r.priority,r.owner,r.due,r.check,r.checkStatus])]
  const html='<?xml version="1.0"?><html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><h2>Play Moments — Relatório de Andamento</h2>'+table(summary)+'<br/>'+table(details)+'</body></html>'
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename(project,'.xls');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function printProjectReportPdf(project:any,team:any[]){
  const reportRows=rows(project,team)
  const win=window.open('','_blank','noopener,noreferrer')
  if(!win)return
  const taskCount=(project?.tasks||[]).filter((t:any)=>t.status!=='cancelled').length
  const completed=(project?.tasks||[]).filter((t:any)=>t.status==='completed').length
  const body=reportRows.map(r=>'<tr><td>'+esc(r.stage)+'</td><td>'+esc(r.task)+'</td><td>'+esc(r.taskStatus)+'</td><td>'+esc(r.owner)+'</td><td>'+esc(r.check)+'</td><td>'+esc(r.checkStatus)+'</td></tr>').join('')
  win.document.write('<!doctype html><html><head><meta charset="UTF-8"><title>'+esc(filename(project,''))+'</title><style>body{font-family:Arial,sans-serif;color:#171717;padding:28px;font-size:12px}h1{font-size:22px;margin:0 0 6px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}.card{border:1px solid #ddd;border-radius:8px;padding:10px}.desc{white-space:pre-wrap;line-height:1.5;margin:16px 0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#f2f2f2}@media print{body{padding:0}@page{size:A4 landscape;margin:12mm}}</style></head><body><h1>Play Moments — Relatório de Andamento</h1><div class="muted">Gerado em '+esc(new Date().toLocaleString('pt-BR'))+'</div><h2>'+esc(project.title)+'</h2><div class="grid"><div class="card"><b>Status</b><br>'+esc(status(project.status))+'</div><div class="card"><b>Progresso</b><br>'+projectProgress(project)+'%</div><div class="card"><b>Tarefas</b><br>'+completed+' / '+taskCount+' concluídas</div><div class="card"><b>Prazo</b><br>'+esc(date(project.due_date))+'</div></div><div class="desc"><b>Objetivo / descrição</b><br>'+esc(project.description||'Sem descrição.')+'</div><table><thead><tr><th>Etapa</th><th>Tarefa</th><th>Status</th><th>Responsável</th><th>Checklist / microtarefa</th><th>Situação</th></tr></thead><tbody>'+body+'</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>')
  win.document.close()
}
