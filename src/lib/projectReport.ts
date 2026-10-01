function esc(value:unknown){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))
}
function date(value?:string|null){
  if(!value)return '—'
  const raw=value.length===10?value+'T12:00:00':value
  const parsed=new Date(raw)
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')
}
function dateTime(value?:string|null){
  if(!value)return '—'
  const parsed=new Date(value)
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleString('pt-BR')
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
function memberName(member:any){
  return member?[member.first_name,member.last_name].filter(Boolean).join(' ')||member.email||'Sem responsável':'Sem responsável'
}
function normalized(project:any,team:any[]){
  const stages=(project?.stages||[]).slice().sort((a:any,b:any)=>(a.position||0)-(b.position||0))
  const tasks=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  const rows:any[]=[]
  for(const task of tasks){
    const stage=stages.find((item:any)=>item.id===task.stage_id)
    const member=team.find((item:any)=>item.id===task.assigned_to)
    const checklist=(task.checklist||[]).slice().sort((a:any,b:any)=>(a.position||0)-(b.position||0))
    const links=task.links||[]
    if(!checklist.length)rows.push({stage,task,member,check:null,links})
    else for(const check of checklist)rows.push({stage,task,member,check,links})
  }
  return {stages,tasks,rows}
}
function filename(project:any,suffix:string){
  const base=String(project?.title||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()
  return 'relatorio-'+base+'-'+new Date().toISOString().slice(0,10)+suffix
}
function reportId(project:any){
  return 'PM-REPORT-'+String(project?.id||'project').slice(0,12)+'-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)
}
function evidenceFor(project:any,taskId:string){
  return (project?.files||[]).filter((file:any)=>file.task_id===taskId)
}
function table(data:any[][]){
  return '<table border="1">'+data.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</table>'
}

export function exportProjectReportSpreadsheet(project:any,team:any[]){
  const data=normalized(project,team)
  const generatedAt=new Date().toISOString()
  const id=reportId(project)
  const summary=[
    ['CAMPO','VALOR'],
    ['Versão do relatório','2.0'],
    ['ID do relatório',id],
    ['ID do projeto',project?.id||'—'],
    ['Projeto',project?.title||'—'],
    ['Tipo',project?.project_type||'—'],
    ['Status',status(project?.status)],
    ['Prioridade',priority(project?.priority)],
    ['Progresso calculado',projectProgress(project)+'%'],
    ['Início',date(project?.start_date)],
    ['Prazo',date(project?.due_date)],
    ['Gerado em',dateTime(generatedAt)],
    ['Objetivo / descrição',project?.description||'Sem descrição.'],
    ['Quantidade de etapas',String(data.stages.length)],
    ['Quantidade de tarefas',String(data.tasks.length)],
    ['Tarefas concluídas',String(data.tasks.filter((t:any)=>t.status==='completed').length)],
    ['Itens de checklist',String(data.tasks.reduce((n:number,t:any)=>n+(t.checklist||[]).length,0))],
    ['Checklist concluído',String(data.tasks.reduce((n:number,t:any)=>n+(t.checklist||[]).filter((i:any)=>i.completed).length,0))],
  ]
  const stages=[
    ['STAGE_ID','Posição','Etapa','Status','Visível ao cliente'],
    ...data.stages.map((stage:any)=>[stage.id,stage.position??'—',stage.name,status(stage.status),stage.client_visible?'Sim':'Não'])
  ]
  const tasks=[
    ['TASK_ID','STAGE_ID','Etapa','Tarefa','Status','Prioridade','Responsável ID','Responsável','Criada em','Atualizada em','Prazo','Concluída em','Visível ao cliente'],
    ...data.tasks.map((task:any)=>{
      const stage=data.stages.find((s:any)=>s.id===task.stage_id)
      const member=team.find((m:any)=>m.id===task.assigned_to)
      return [task.id,task.stage_id||'—',stage?.name||'Sem etapa',task.title,status(task.status),priority(task.priority),task.assigned_to||'—',memberName(member),dateTime(task.created_at),dateTime(task.updated_at),date(task.due_date),dateTime(task.completed_at),task.client_visible?'Sim':'Não']
    })
  ]
  const checklist=[
    ['CHECKLIST_ID','TASK_ID','Tarefa','CHECKLIST / MICROTAREFA','Concluído','Posição','Criado em','Atualizado em'],
    ...data.tasks.flatMap((task:any)=>(task.checklist||[]).map((item:any)=>[item.id,task.id,task.title,item.title,item.completed?'Sim':'Não',item.position??'—',dateTime(item.created_at),dateTime(item.updated_at)]))
  ]
  const links=[
    ['LINK_ID','TASK_ID','Tarefa','Rótulo','URL','Tipo','Visível ao cliente'],
    ...data.tasks.flatMap((task:any)=>(task.links||[]).map((link:any)=>[link.id,task.id,task.title,link.label,link.url,link.link_type||'reference',link.client_visible?'Sim':'Não']))
  ]
  const files=[
    ['FILE_ID','TASK_ID','STAGE_ID','Nome','Tipo','Provedor','Pasta','Visível ao cliente','Versão','Criado em','Atualizado em','URL/REFERÊNCIA'],
    ...((project?.files||[]).map((file:any)=>[file.id,file.task_id||'—',file.stage_id||'—',file.name,file.mime_type||file.file_type||'—',file.storage_provider||'—',file.folder_kind||'—',file.client_visible?'Sim':'Não',file.version_number||1,dateTime(file.created_at),dateTime(file.updated_at),file.external_url||file.storage_path||'—']))
  ]
  const instructions=[
    ['COMO USAR ESTE RELATÓRIO'],
    ['Este arquivo é a fotografia operacional do projeto no momento da exportação.'],
    ['Os IDs são mantidos propositalmente para permitir atualização incremental via SQL sem recriar tarefas.'],
    ['Para atualizar o sistema a partir de uma execução posterior, compare ID + estado atual + checklist + vínculos.'],
    ['Não trate nomes isolados como identificadores quando houver ID disponível.'],
    ['Itens não presentes neste relatório não devem ser presumidos como removidos.'],
  ]
  const sheets=[
    '<h2>Play Moments — Relatório operacional do projeto</h2>'+table(summary),
    '<h3>ETAPAS</h3>'+table(stages),
    '<h3>TAREFAS</h3>'+table(tasks),
    '<h3>CHECKLIST / MICROTAREFAS</h3>'+table(checklist),
    '<h3>LINKS</h3>'+table(links),
    '<h3>ARQUIVOS / EVIDÊNCIAS</h3>'+table(files),
    '<h3>INSTRUÇÕES PARA ATUALIZAÇÃO</h3>'+table(instructions)
  ]
  const html='<?xml version="1.0"?><html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial}table{border-collapse:collapse;margin-bottom:24px}td{padding:5px;border:1px solid #bbb;vertical-align:top}h2,h3{margin-top:20px}</style></head><body>'+sheets.join('<hr/>')+'</body></html>'
  const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url
  a.download=filename(project,'.xls')
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export function printProjectReportPdf(project:any,team:any[]){
  const data=normalized(project,team)
  const generatedAt=new Date().toISOString()
  const id=reportId(project)
  const taskCount=data.tasks.length
  const completed=data.tasks.filter((t:any)=>t.status==='completed').length
  const checklistItems=data.tasks.reduce((n:number,t:any)=>n+(t.checklist||[]).length,0)
  const checklistDone=data.tasks.reduce((n:number,t:any)=>n+(t.checklist||[]).filter((i:any)=>i.completed).length,0)
  const taskRows=data.rows.map((r:any)=>{
    const evidence=evidenceFor(project,r.task.id)
    const links=(r.links||[]).map((l:any)=>l.label+': '+l.url).join(' | ')
    return '<tr><td>'+esc(r.stage?.name||'Sem etapa')+'</td><td><b>'+esc(r.task.title)+'</b><br><small>ID: '+esc(r.task.id)+'</small></td><td>'+esc(status(r.task.status))+'</td><td>'+esc(priority(r.task.priority))+'</td><td>'+esc(memberName(r.member))+'</td><td>'+esc(r.task.due_date?date(r.task.due_date):'—')+'</td><td>'+esc(r.check?.title||'—')+'<br><small>'+esc(r.check?.id||'')+' '+(r.check?(r.check.completed?'✓ Concluído':'○ Pendente'):'')+'</small></td><td>'+esc(evidence.map((f:any)=>f.name).join(', ')||links||'—')+'</td></tr>'
  }).join('')
  const stageRows=data.stages.map((s:any)=>'<tr><td>'+esc(s.id)+'</td><td>'+esc(s.name)+'</td><td>'+esc(status(s.status))+'</td><td>'+esc(String(s.position??'—'))+'</td><td>'+esc(s.client_visible?'Sim':'Não')+'</td></tr>').join('')
  const linkRows=data.tasks.flatMap((t:any)=>(t.links||[]).map((l:any)=>'<tr><td>'+esc(l.id)+'</td><td>'+esc(t.id)+'</td><td>'+esc(l.label)+'</td><td class="url">'+esc(l.url)+'</td><td>'+esc(l.client_visible?'Sim':'Não')+'</td></tr>')).join('')
  const fileRows=(project?.files||[]).map((f:any)=>'<tr><td>'+esc(f.id)+'</td><td>'+esc(f.task_id||'—')+'</td><td>'+esc(f.name)+'</td><td>'+esc(f.mime_type||f.file_type||'—')+'</td><td>'+esc(f.version_number||1)+'</td><td>'+esc(f.external_url||f.storage_path||'—')+'</td></tr>').join('')
  const checklistRows=data.tasks.flatMap((t:any)=>(t.checklist||[]).map((i:any)=>'<tr><td>'+esc(i.id)+'</td><td>'+esc(t.id)+'</td><td>'+esc(i.title)+'</td><td>'+esc(i.completed?'Concluído':'Pendente')+'</td></tr>')).join('')
  const win=window.open('','_blank','width=1200,height=900,scrollbars=yes')
  if(!win){
    window.alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e clique em “Gerar PDF” novamente.')
    return
  }
  const html='<!doctype html><html><head><meta charset="UTF-8"><title>'+esc(filename(project,''))+'</title><style>'+
    'body{font-family:Arial,sans-serif;color:#171717;padding:28px;font-size:10px;line-height:1.35}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:2px solid #222;padding-bottom:4px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.card{border:1px solid #ccc;border-radius:7px;padding:9px}.card b{font-size:9px;text-transform:uppercase;color:#666}.card strong{display:block;font-size:15px;margin-top:3px}.desc{white-space:pre-wrap;line-height:1.5;border:1px solid #ddd;padding:9px;border-radius:7px}table{width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}th{background:#f1f1f1;font-size:9px}.url{word-break:break-all}@media print{body{padding:0}@page{size:A4 landscape;margin:10mm}}'+
    '</style></head><body>'+
    '<h1>Play Moments — Relatório de acompanhamento do projeto</h1>'+
    '<div class="muted">Relatório '+esc(id)+' · versão 2.0 · gerado em '+esc(dateTime(generatedAt))+'</div>'+
    '<h2>'+esc(project?.title||'Projeto')+'</h2>'+
    '<div class="grid"><div class="card"><b>Status</b><strong>'+esc(status(project?.status))+'</strong></div><div class="card"><b>Progresso</b><strong>'+projectProgress(project)+'%</strong></div><div class="card"><b>Tarefas</b><strong>'+completed+' / '+taskCount+'</strong></div><div class="card"><b>Checklist</b><strong>'+checklistDone+' / '+checklistItems+'</strong></div></div>'+
    '<div class="desc"><b>Objetivo / descrição</b><br>'+esc(project?.description||'Sem descrição.')+'</div>'+
    '<p><b>ID do projeto:</b> '+esc(project?.id||'—')+' &nbsp; <b>Início:</b> '+esc(date(project?.start_date))+' &nbsp; <b>Prazo:</b> '+esc(date(project?.due_date))+' &nbsp; <b>Prioridade:</b> '+esc(priority(project?.priority))+'</p>'+
    '<h2>Etapas</h2><table><thead><tr><th>ID</th><th>Etapa</th><th>Status</th><th>Posição</th><th>Cliente</th></tr></thead><tbody>'+stageRows+'</tbody></table>'+
    '<h2>Tarefas e checklist</h2><table><thead><tr><th>Etapa</th><th>Tarefa / ID</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Checklist / ID</th><th>Evidência / links</th></tr></thead><tbody>'+taskRows+'</tbody></table>'+
    '<h2>Checklist completo</h2><table><thead><tr><th>CHECKLIST_ID</th><th>TASK_ID</th><th>Item</th><th>Situação</th></tr></thead><tbody>'+checklistRows+'</tbody></table>'+
    '<h2>Links vinculados</h2><table><thead><tr><th>LINK_ID</th><th>TASK_ID</th><th>Rótulo</th><th>URL</th><th>Cliente</th></tr></thead><tbody>'+linkRows+'</tbody></table>'+
    '<h2>Arquivos / evidências</h2><table><thead><tr><th>FILE_ID</th><th>TASK_ID</th><th>Arquivo</th><th>Tipo</th><th>Versão</th><th>Referência</th></tr></thead><tbody>'+fileRows+'</tbody></table>'+
    '<h2>Como usar para atualização</h2><div class="desc">Este relatório é uma fotografia do estado do projeto. Os IDs são identificadores estáveis e devem ser usados para gerar atualizações incrementais. Compare relatório anterior e atual por ID, status, progresso/checklist, responsáveis, prazos, links e evidências. Não recrie tarefas existentes e não presuma exclusões apenas porque um item não apareceu em uma diferença parcial.</div>'+
    '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250))<\\/script></body></html>'
  win.document.open()
  win.document.write(html)
  win.document.close()
}
