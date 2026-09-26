import { supabase } from '../lib/supabase'

export type OperationalReport={
  summary:{
    new_customers:number
    orders:number
    orders_total:number
    paid_revenue:number
    pending_revenue:number
    quotes:number
    accepted_quotes:number
    projects_completed:number
    projects_overdue:number
    tasks_completed:number
    tasks_overdue:number
    avg_order_ticket:number
  }
  sales_by_month:Array<{month:string;orders:number;total:number}>
  top_items:Array<{name:string;quantity:number;total:number}>
  project_statuses:Array<{status:string;count:number}>
  task_productivity:Array<{assignee:string;completed:number;overdue:number}>
}

export const reportsApi={
  operational:async(startDate:string,endDate:string):Promise<OperationalReport>=>{
    const {data,error}=await supabase.rpc('operational_report',{
      p_start_date:startDate,
      p_end_date:endDate,
    })
    if(error)throw error
    return data as OperationalReport
  },
  audit:async(filters?:{
    startDate?:string
    endDate?:string
    table?:string
    action?:string
    actor?:string
    limit?:number
  })=>{
    let query=supabase.from('audit_logs')
      .select('*,actor:profiles!audit_logs_actor_user_id_fkey(id,email,first_name,last_name,role)')
      .order('created_at',{ascending:false})
      .limit(filters?.limit||200)

    if(filters?.startDate)query=query.gte('created_at',filters.startDate+'T00:00:00')
    if(filters?.endDate)query=query.lt('created_at',new Date(new Date(filters.endDate+'T00:00:00').getTime()+86400000).toISOString())
    if(filters?.table&&filters.table!=='all')query=query.eq('table_name',filters.table)
    if(filters?.action&&filters.action!=='all')query=query.eq('action',filters.action)
    if(filters?.actor)query=query.eq('actor_user_id',filters.actor)

    const {data,error}=await query
    if(error)throw error
    return (data||[]).map((row:any)=>({
      ...row,
      actor:Array.isArray(row.actor)?row.actor[0]||null:row.actor,
    }))
  },
}
