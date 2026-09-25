import { supabase } from '../lib/supabase'

async function invoke(body:Record<string,unknown>){
  const {data,error}=await supabase.functions.invoke('admin-delete-customer-all',{body})
  if(error){
    const context=(error as any)?.context
    let message='Não foi possível concluir a exclusão.'
    try{
      const payload=await context?.json?.()
      if(payload?.error)message=payload.error
    }catch{}
    throw new Error(message)
  }
  if(!data?.ok)throw new Error(data?.error||'Não foi possível concluir a exclusão.')
  return data
}

export const customerDeletionApi={
  preview:(customerId:string,email:string)=>invoke({action:'preview',customer_id:customerId,confirmation:email}),
  removeEmpty:(customerId:string,email:string)=>invoke({action:'standard',customer_id:customerId,confirmation:email}),
  removeAll:(customerId:string,email:string,phrase:string)=>invoke({action:'force',customer_id:customerId,confirmation:email,phrase}),
}
