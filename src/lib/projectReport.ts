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

function xmlEsc(value:unknown){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;')
}
function colName(index:number){
  let n=index+1
  let out=''
  while(n>0){
    const rem=(n-1)%26
    out=String.fromCharCode(65+rem)+out
    n=Math.floor((n-1)/26)
  }
  return out
}
function crc32(bytes:Uint8Array){
  let crc=0xffffffff
  for(const byte of bytes){
    crc^=byte
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)
  }
  return (crc^0xffffffff)>>>0
}
function u16(value:number){
  return new Uint8Array([value&255,(value>>>8)&255])
}
function u32(value:number){
  return new Uint8Array([value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255])
}
function concatBytes(parts:Uint8Array[]){
  const total=parts.reduce((sum,item)=>sum+item.length,0)
  const out=new Uint8Array(total)
  let offset=0
  for(const part of parts){out.set(part,offset);offset+=part.length}
  return out
}
function zipStored(entries:Array<{name:string;content:string}>){
  const encoder=new TextEncoder()
  const now=new Date()
  const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2)
  const dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate()
  const localParts:Uint8Array[]=[]
  const centralParts:Uint8Array[]=[]
  let offset=0
  for(const entry of entries){
    const name=encoder.encode(entry.name)
    const data=encoder.encode(entry.content)
    const crc=crc32(data)
    const local=concatBytes([
      u32(0x04034b50),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),
      u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data
    ])
    localParts.push(local)
    const central=concatBytes([
      u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),
      u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),
      u32(0),u32(offset),name
    ])
    centralParts.push(central)
    offset+=local.length
  }
  const central=concatBytes(centralParts)
  const locals=concatBytes(localParts)
  const end=concatBytes([
    u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),
    u32(central.length),u32(locals.length),u16(0)
  ])
  return concatBytes([locals,central,end])
}
function xlsxCell(ref:string,value:unknown,style:number,number=false){
  if(value===null||value===undefined||value==='')return '<c r="'+ref+'" s="'+style+'"/>'
  if(number){
    const raw=Number(value)
    return Number.isFinite(raw)?'<c r="'+ref+'" s="'+style+'" t="n"><v>'+raw+'</v></c>':'<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t>'+xmlEsc(value)+'</t></is></c>'
  }
  return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEsc(value)+'</t></is></c>'
}
function xlsxSheet(title:string,headers:string[],rows:any[][],widths:number[]){
  const maxCols=Math.max(headers.length,...rows.map(row=>row.length),1)
  const titleEnd=colName(maxCols-1)
  const cols=widths.map((width,index)=>'<col min="'+(index+1)+'" max="'+(index+1)+'" width="'+width+'" customWidth="1"/>').join('')
  const titleRow='<row r="1" ht="28"><c r="A1" s="1" t="inlineStr"><is><t>'+xmlEsc(title)+'</t></is></c></row>'
  const merged='<mergeCells count="1"><mergeCell ref="A1:'+titleEnd+'1"/></mergeCells>'
  const headerCells=headers.map((value,index)=>xlsxCell(colName(index)+'3',value,2)).join('')
  const headerRow='<row r="3" ht="24">'+headerCells+'</row>'
  const body=rows.map((row,rowIndex)=>{
    const excelRow=rowIndex+4
    const styleBase=rowIndex%2===0?4:5
    const cells=Array.from({length:headers.length},(_,index)=>{
      const value=row[index]??''
      const isId=index===0 && /_ID$/.test(headers[index]||'')
      const isNumeric=typeof value==='number'
      return xlsxCell(colName(index)+excelRow,value,isId?6:styleBase,isNumeric)
    }).join('')
    return '<row r="'+excelRow+'">'+cells+'</row>'
  }).join('')
  const lastRow=Math.max(3,rows.length+3)
  const filter=headers.length?' autoFilter ref="A3:'+titleEnd+lastRow+'"':''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    '<cols>'+cols+'</cols><sheetData>'+titleRow+'<row r="2" ht="8"/>'+headerRow+body+'</sheetData>'+merged+
    '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'+
    '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9" fitToPage="1"/>'+
    '<printOptions horizontalCentered="0" verticalCentered="0"/>'+
    '<sheetFormatPr defaultRowHeight="18"/>'+filter+'</worksheet>'
}
function xlsxWorkbook(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>'+
    '<sheet name="Resumo" sheetId="1" r:id="rId1"/>'+
    '<sheet name="Etapas" sheetId="2" r:id="rId2"/>'+
    '<sheet name="Tarefas" sheetId="3" r:id="rId3"/>'+
    '<sheet name="Checklist" sheetId="4" r:id="rId4"/>'+
    '<sheet name="Links" sheetId="5" r:id="rId5"/>'+
    '<sheet name="Arquivos" sheetId="6" r:id="rId6"/>'+
    '<sheet name="Atualizacao" sheetId="7" r:id="rId7"/>'+
    '</sheets></workbook>'
}
function xlsxStyles(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<numFmts count="0"/>'+
    '<fonts count="4">'+
    '<font><sz val="10"/><name val="Aptos"/></font>'+
    '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font>'+
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>'+
    '<font><b/><sz val="10"/><color rgb="FF555555"/><name val="Aptos"/></font>'+
    '</fonts>'+
    '<fills count="6">'+
    '<fill><patternFill patternType="none"/></fill>'+
    '<fill><patternFill patternType="gray125"/></fill>'+
    '<fill><patternFill patternType="solid"><fgColor rgb="FF151515"/><bgColor indexed="64"/></patternFill></fill>'+
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE30613"/><bgColor indexed="64"/></patternFill></fill>'+
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F7F7"/><bgColor indexed="64"/></patternFill></fill>'+
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>'+
    '</fills>'+
    '<borders count="3">'+
    '<border><left/><right/><top/><bottom/><diagonal/></border>'+
    '<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>'+
    '<border><left style="thin"><color rgb="FFE2E2E2"/></left><right style="thin"><color rgb="FFE2E2E2"/></right><top style="thin"><color rgb="FFE2E2E2"/></top><bottom style="thin"><color rgb="FFE2E2E2"/></bottom><diagonal/></border>'+
    '</borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="7">'+
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf>'+
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '</cellXfs></styleSheet>'
}
function xlsxContentTypes(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    Array.from({length:7},(_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
    '</Types>'
}
function xlsxRootRels(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>'
}
function xlsxWorkbookRels(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'+
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'+
    '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>'+
    '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>'+
    '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet6.xml"/>'+
    '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet7.xml"/>'+
    '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>'
}

export function exportProjectReportSpreadsheet(project:any,team:any[]){
  const data=normalized(project,team)
  const generatedAt=new Date().toISOString()
  const id=reportId(project)
  const taskCount=data.tasks.length
  const completed=data.tasks.filter((task:any)=>task.status==='completed').length
  const checklistItems=data.tasks.reduce((n:number,task:any)=>n+(task.checklist||[]).length,0)
  const checklistDone=data.tasks.reduce((n:number,task:any)=>n+(task.checklist||[]).filter((item:any)=>item.completed).length,0)

  const summaryRows=[
    ['Versão do relatório','3.0'],
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
    ['Quantidade de etapas',data.stages.length],
    ['Quantidade de tarefas',taskCount],
    ['Tarefas concluídas',completed],
    ['Itens de checklist',checklistItems],
    ['Checklist concluído',checklistDone],
  ]
  const stageRows=data.stages.map((stage:any)=>[
    stage.id,stage.position??'—',stage.name,status(stage.status),stage.client_visible?'Sim':'Não'
  ])
  const taskRows=data.tasks.map((task:any)=>{
    const stage=data.stages.find((stage:any)=>stage.id===task.stage_id)
    const member=team.find((member:any)=>member.id===task.assigned_to)
    return [
      task.id,task.stage_id||'—',stage?.name||'Sem etapa',task.title,status(task.status),priority(task.priority),
      task.assigned_to||'—',memberName(member),dateTime(task.created_at),dateTime(task.updated_at),
      date(task.due_date),dateTime(task.completed_at),task.client_visible?'Sim':'Não'
    ]
  })
  const checklistRows=data.tasks.flatMap((task:any)=>(task.checklist||[]).map((item:any)=>[
    item.id,task.id,task.title,item.title,item.completed?'Sim':'Não',item.position??'—',dateTime(item.created_at),dateTime(item.updated_at)
  ]))
  const linkRows=data.tasks.flatMap((task:any)=>(task.links||[]).map((link:any)=>[
    link.id,task.id,task.title,link.label,link.url,link.link_type||'reference',link.client_visible?'Sim':'Não'
  ]))
  const fileRows=(project?.files||[]).map((file:any)=>[
    file.id,file.task_id||'—',file.stage_id||'—',file.name,file.mime_type||file.file_type||'—',
    file.storage_provider||'—',file.folder_kind||'—',file.client_visible?'Sim':'Não',
    file.version_number||1,dateTime(file.created_at),dateTime(file.updated_at),file.external_url||file.storage_path||'—'
  ])
  const updateRows=[
    ['Como interpretar','Use sempre os IDs como identificadores estáveis. Não use somente o nome da tarefa para gerar UPDATE.'],
    ['Atualização incremental','Compare relatório anterior e atual por ID, status, responsável, prazo, checklist, links e evidências.'],
    ['Checklist','Cada CHECKLIST_ID representa uma microtarefa independente e pode alterar o progresso calculado do projeto.'],
    ['Evidências','FILE_ID e LINK_ID preservam o vínculo com tarefas e etapas; ausência em uma diferença parcial não significa exclusão.'],
    ['SQL','Ao solicitar uma atualização SQL, este relatório deve ser a fonte operacional para montar comandos UPDATE/INSERT sem recriar itens existentes.'],
    ['Segurança','Antes de executar SQL gerado, conferir IDs e executar primeiro SELECTs de validação.'],
  ]

  const sheets=[
    xlsxSheet('Play Moments — Relatório operacional do projeto',['CAMPO','VALOR'],summaryRows,[28,90]),
    xlsxSheet('Etapas',['STAGE_ID','Posição','Etapa','Status','Visível ao cliente'],stageRows,[38,10,38,18,18]),
    xlsxSheet('Tarefas',['TASK_ID','STAGE_ID','Etapa','Tarefa','Status','Prioridade','Responsável ID','Responsável','Criada em','Atualizada em','Prazo','Concluída em','Visível ao cliente'],taskRows,[38,38,30,52,18,16,38,28,22,22,14,22,18]),
    xlsxSheet('Checklist / microtarefas',['CHECKLIST_ID','TASK_ID','Tarefa','CHECKLIST / MICROTAREFA','Concluído','Posição','Criado em','Atualizado em'],checklistRows,[38,38,32,58,16,10,22,22]),
    xlsxSheet('Links vinculados',['LINK_ID','TASK_ID','Tarefa','Rótulo','URL','Tipo','Visível ao cliente'],linkRows,[38,38,32,26,70,18,18]),
    xlsxSheet('Arquivos / evidências',['FILE_ID','TASK_ID','STAGE_ID','Nome','Tipo','Provedor','Pasta','Visível ao cliente','Versão','Criado em','Atualizado em','URL / REFERÊNCIA'],fileRows,[38,38,38,42,28,20,24,18,10,22,22,70]),
    xlsxSheet('Guia para atualização',['CAMPO','ORIENTAÇÃO'],updateRows,[24,100]),
  ]

  const entries=[
    {name:'[Content_Types].xml',content:xlsxContentTypes()},
    {name:'_rels/.rels',content:xlsxRootRels()},
    {name:'xl/workbook.xml',content:xlsxWorkbook()},
    {name:'xl/_rels/workbook.xml.rels',content:xlsxWorkbookRels()},
    {name:'xl/styles.xml',content:xlsxStyles()},
    ...sheets.map((content,index)=>({name:'xl/worksheets/sheet'+(index+1)+'.xml',content})),
  ]
  const bytes=zipStored(entries)
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=filename(project,'.xlsx')
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
