import { supabase } from '../lib/supabase'

export type CrmStage='new_contact'|'in_service'|'quote'|'negotiation'|'won'|'production'|'delivered'|'lost'

export type CrmCustomer={
  customer_id:string
  stage:CrmStage
  owner_id:string|null
  source:string|null
  next_action:string|null
  next_action_at:string|null
  last_contact_at:string|null
  estimated_value:number
  internal_notes:string|null
  lost_reason:string|null
  created_at:string
  updated_at:string
  customer:any
  owner:any
  customerAutoEvent:async(event:'service_interest'|'product_interest'|'custom_project'|'support_request',detail?:string)=>{
    const {data,error}=await supabase.rpc('customer_autoattendant_crm_event',{
      p_event:event,
      p_detail:detail?.trim()||null,
    })
    if(error)throw error
    return data
  },
}

export const CRM_STAGE_LABELS:Record<CrmStage,string>={
  new_contact:'Novo contato',
  in_service:'Em atendimento',
  quote:'Orçamento',
  negotiation:'Negociação',
  won:'Fechado',
  production:'Em produção',
  delivered:'Entregue',
  lost:'Perdido',
}

export const CRM_STAGES:CrmStage[]=[
  'new_contact','in_service','quote','negotiation','won','production','delivered','lost',
]

export const crmApi={
  list:async():Promise<CrmCustomer[]>=>{
    const {data,error}=await supabase.from('customer_crm')
      .select('*,customer:profiles!customer_crm_customer_id_fkey(id,email,first_name,last_name,phone,status,created_at),owner:profiles!customer_crm_owner_id_fkey(id,email,first_name,last_name,role)')
      .order('updated_at',{ascending:false})
    if(error)throw error
    return (data||[]).map((row:any)=>({
      ...row,
      customer:Array.isArray(row.customer)?row.customer[0]||null:row.customer,
      owner:Array.isArray(row.owner)?row.owner[0]||null:row.owner,
    })) as CrmCustomer[]
  },

  one:async(customerId:string):Promise<CrmCustomer|null>=>{
    const {data,error}=await supabase.from('customer_crm')
      .select('*,customer:profiles!customer_crm_customer_id_fkey(id,email,first_name,last_name,phone,status,created_at),owner:profiles!customer_crm_owner_id_fkey(id,email,first_name,last_name,role)')
      .eq('customer_id',customerId).maybeSingle()
    if(error)throw error
    if(!data)return null
    return {
      ...data,
      customer:Array.isArray((data as any).customer)?(data as any).customer[0]||null:(data as any).customer,
      owner:Array.isArray((data as any).owner)?(data as any).owner[0]||null:(data as any).owner,
    } as CrmCustomer
  },

  history:async(customerId:string)=>{
    const {data,error}=await supabase.from('customer_crm_history')
      .select('*,changed_by_profile:profiles!customer_crm_history_changed_by_fkey(first_name,last_name,email)')
      .eq('customer_id',customerId).order('created_at',{ascending:false})
    if(error)throw error
    return data||[]
  },

  save:async(values:{
    customer_id:string
    stage?:CrmStage
    owner_id?:string|null
    source?:string|null
    next_action?:string|null
    next_action_at?:string|null
    last_contact_at?:string|null
    estimated_value?:number|null
    internal_notes?:string|null
    lost_reason?:string|null
    stage_note?:string|null
  })=>{
    const {data,error}=await supabase.rpc('save_customer_crm',{
      p_customer_id:values.customer_id,
      p_stage:values.stage||null,
      p_owner_id:values.owner_id??null,
      p_source:values.source??null,
      p_next_action:values.next_action??null,
      p_next_action_at:values.next_action_at??null,
      p_last_contact_at:values.last_contact_at??null,
      p_estimated_value:values.estimated_value??null,
      p_internal_notes:values.internal_notes??null,
      p_lost_reason:values.lost_reason??null,
      p_stage_note:values.stage_note??null,
    })
    if(error)throw error
    return data
  },
}
