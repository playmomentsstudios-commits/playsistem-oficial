import { supabase } from '../lib/supabase'

async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('google-drive-file-manage',{body})
  if(error)throw error
  if(!data?.ok)throw new Error(data?.error||'Não foi possível concluir a ação no arquivo.')
  return data
}

export const fileManagementApi={
  rename: (fileId:string,name:string)=>invoke({action:'rename',file_id:fileId,name}),
  move: (fileId:string,folderKind:string)=>invoke({action:'move',file_id:fileId,folder_kind:folderKind}),
  remove: (fileId:string)=>invoke({action:'delete',file_id:fileId}),
}
