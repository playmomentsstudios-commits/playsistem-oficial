import { supabase } from '../lib/supabase'

export type AutoSolution={
 id:string; name:string; kind:'service'|'product'|'academy'|'support'; keywords:string[]; response:string;
 question:string|null; route:string|null; crm_event:string|null; active:boolean; priority:number; updated_at:string
}

export const autoattendantApi={
 list:async():Promise<AutoSolution[]>=>{
  const {data,error}=await supabase.from('autoattendant_solutions').select('*').order('priority',{ascending:false}).order('name')
  if(error)throw error
  return (data||[]) as AutoSolution[]
 },
 save:async(item:Partial<AutoSolution>)=>{
  const payload={...item,keywords:(item.keywords||[]).map(v=>v.trim().toLowerCase()).filter(Boolean)}
  const {data,error}=item.id
   ? await supabase.from('autoattendant_solutions').update(payload).eq('id',item.id).select().single()
   : await supabase.from('autoattendant_solutions').insert(payload).select().single()
  if(error)throw error
  return data as AutoSolution
 },
 remove:async(id:string)=>{
  const {error}=await supabase.from('autoattendant_solutions').delete().eq('id',id)
  if(error)throw error
 },
}
