// A Drive folder is a physical location; stages and tasks are logical
// delivery associations. Neither representation should overwrite the other.
export const standardProjectFolders=[
  {kind:'received',label:'01 - Arquivos recebidos'},
  {kind:'raw',label:'02 - Brutos'},
  {kind:'production',label:'03 - Produção'},
  {kind:'preview',label:'04 - Prévia'},
  {kind:'approved',label:'05 - Aprovados'},
  {kind:'delivery',label:'06 - Entrega final'},
] as const

type Row=Record<string,any>
type FolderGroup={key:string;name:string;kind:string;files:Row[];parent?:string}

export function adminProjectFolderGroups(
  files:Row[], standard:Row[], custom:Row[], stageFolders:Row[],
  projectRootId?:string|null,
){
  const byId=new Map<string,FolderGroup>()
  const groups:FolderGroup[]=[]
  for(const folder of standardProjectFolders){
    const item:FolderGroup={key:'standard:'+folder.kind,name:folder.label,kind:folder.kind,files:[]}
    groups.push(item)
    const registered=standard.find((row:Row)=>row.folder_kind===folder.kind)
    if(registered?.drive_folder_id)byId.set(registered.drive_folder_id,item)
  }
  for(const folder of custom){
    const item:FolderGroup={key:'custom:'+folder.id,name:folder.name,kind:'custom',parent:standardProjectFolders.find(row=>row.kind===folder.parent_kind)?.label||'Pasta personalizada',files:[]}
    groups.push(item)
    if(folder.drive_folder_id)byId.set(folder.drive_folder_id,item)
  }
  for(const folder of stageFolders){
    const item:FolderGroup={key:'stage:'+folder.stage_id,name:folder.folder_name||'Pasta da etapa',kind:'stage',files:[]}
    groups.push(item)
    if(folder.drive_folder_id)byId.set(folder.drive_folder_id,item)
  }
  const root:FolderGroup={key:'root',name:'Raiz do projeto',kind:'root',files:[]}
  const unknown:FolderGroup={key:'other',name:'Outras subpastas do Drive',kind:'other',files:[]}
  for(const file of files){
    const group=file.drive_folder_id?byId.get(file.drive_folder_id):null
    if(group)group.files.push(file)
    else if(file.drive_folder_id===projectRootId||!file.drive_folder_id)root.files.push(file)
    else unknown.files.push(file)
  }
  return [...groups,...(root.files.length?[root]:[]),...(unknown.files.length?[unknown]:[])]
}

export function customerProjectFileGroups(files:Row[],stages:Row[],tasks:Row[]){
  const allowedStages=new Map(stages.filter(row=>row.client_visible).map(row=>[row.id,row]))
  const allowedTasks=new Map(tasks.filter(row=>row.client_visible&&(!row.stage_id||allowedStages.has(row.stage_id))).map(row=>[row.id,row]))
  const output=new Map<string,{key:string;title:string;description:string;stageId:string|null;taskId:string|null;files:Row[]}>()
  for(const file of files){
    if(!file.client_visible)continue
    // The client may not discover content associated with a private task/stage.
    const task=file.task_id?allowedTasks.get(file.task_id):null
    if(file.task_id&&!task)continue
    const stageId=task?.stage_id||file.stage_id||null
    const stage=stageId?allowedStages.get(stageId):null
    if(stageId&&!stage)continue
    if(file.stage_id&&file.stage_id!==stageId&&!allowedStages.has(file.stage_id))continue
    const key=task?'task:'+task.id:stage?'stage:'+stage.id:'general'
    if(!output.has(key)){
      output.set(key,{
        key,title:task?task.title:stage?stage.name:'Materiais gerais do projeto',
        description:task&&stage?'Etapa: '+stage.name:stage?'Arquivos desta etapa':'Arquivos gerais liberados pela equipe',
        stageId:stage?.id||null,taskId:task?.id||null,files:[],
      })
    }
    output.get(key)!.files.push(file)
  }
  const position=(key:string)=>{
    const group=output.get(key)!
    const stage=allowedStages.get(group.stageId)
    const task=allowedTasks.get(group.taskId)
    return group.key==='general'?Number.MAX_SAFE_INTEGER:(Number(stage?.position)||0)*100000+(task?Number(task.position||0)+1:0)
  }
  return [...output.keys()].sort((a,b)=>position(a)-position(b)).map(key=>output.get(key)!)
}
