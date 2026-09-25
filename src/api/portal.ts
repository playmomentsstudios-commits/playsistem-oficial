import { supabase } from '../lib/supabase'

export const portalApi = {
  customers: async () => {
    const { data, error } = await supabase.from('profiles')
      .select('id,email,first_name,last_name,phone,status,status_reason_code,status_changed_at,status_changed_by,created_at')
      .eq('role','customer').order('created_at',{ascending:false})
    if (error) throw error
    return data ?? []
  },
  updateProfile: async (id:string, values:{first_name:string;last_name:string;phone:string|null}) => {
    const { error } = await supabase.from('profiles').update(values).eq('id',id)
    if (error) throw error
  },
  setCustomerStatus: async (customerId:string,status:'active'|'inactive'|'blocked',reasonCode?:string|null) => {
    const { error } = await supabase.rpc('admin_set_customer_status',{
      p_customer_id:customerId,
      p_status:status,
      p_reason_code:reasonCode||null,
    })
    if(error) throw error
  },
  customerStatusHistory: async (customerId:string) => {
    const { data,error }=await supabase.from('customer_status_history')
      .select('*').eq('customer_id',customerId).order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  customerLoyalty: async (customerId:string) => {
    const { data,error }=await supabase.from('customer_loyalty')
      .select('*').eq('customer_id',customerId).maybeSingle()
    if(error) throw error
    return data
  },
  loyaltySettings: async () => {
    const { data,error }=await supabase.from('loyalty_settings').select('*').eq('id',true).maybeSingle()
    if(error) throw error
    return data
  },
  saveLoyaltySettings: async (values:{cashback_basis_points:number;silver_threshold:number|null;gold_threshold:number|null;updated_by:string}) => {
    const { error }=await supabase.from('loyalty_settings').update({
      ...values,
      updated_at:new Date().toISOString(),
    }).eq('id',true)
    if(error) throw error
  },
  services: async (admin=false) => {
    let q = supabase.from('services').select('*').order('created_at',{ascending:false})
    if (!admin) q = q.eq('active',true).eq('status','published')
    const { data,error } = await q
    if (error) throw error
    return data ?? []
  },
  saveService: async (values:any, id?:string) => {
    const q = id ? supabase.from('services').update(values).eq('id',id) : supabase.from('services').insert(values)
    const { error } = await q
    if (error) throw error
  },
  requestService: async (id:string) => {
    const { data,error } = await supabase.rpc('request_service',{p_service_id:id})
    if(error) throw error
    return data as string
  },
  createProductOrder: async (id:string) => {
    const { data,error } = await supabase.rpc('create_product_order',{p_product_id:id})
    if(error) throw error
    return data as string
  },
  createCartOrder: async (items:Array<{product_id:string;quantity:number}>) => {
    const { data,error } = await supabase.rpc('create_cart_order',{p_items:items})
    if(error) throw error
    return data as string
  },
  order: async (id:string) => {
    const { data,error } = await supabase.from('orders')
      .select('*,items:order_items(*),payments(*),projects(id,title,status,due_date)')
      .eq('id',id).maybeSingle()
    if(error) throw error
    return data
  },
  orders: async () => {
    const { data,error } = await supabase.from('orders')
      .select('*,items:order_items(*)').order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  updateOrder: async (id:string,status:string) => {
    const { error } = await supabase.from('orders').update({status}).eq('id',id)
    if(error) throw error
  },
  applyPlayCash: async (orderId:string,amount?:number|null) => {
    const { data,error }=await supabase.rpc('apply_play_cash_to_order',{
      p_order_id:orderId,
      p_amount:amount||null,
    })
    if(error) throw error
    return data as number
  },
  quotes: async () => {
    const { data,error } = await supabase.from('quotes')
      .select('*,items:quote_items(*),customer:profiles!quotes_customer_id_fkey(id,email,first_name,last_name)')
      .order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  quote: async (id:string) => {
    const { data,error } = await supabase.from('quotes')
      .select('*,items:quote_items(*),customer:profiles!quotes_customer_id_fkey(id,email,first_name,last_name)')
      .eq('id',id).maybeSingle()
    if(error) throw error
    return data
  },
  createQuote: async (values:any) => {
    const { data,error }=await supabase.from('quotes').insert(values).select().single()
    if(error) throw error
    return data
  },
  saveQuoteItem: async (values:any,id?:string) => {
    const q=id?supabase.from('quote_items').update(values).eq('id',id):supabase.from('quote_items').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  deleteQuoteItem: async (id:string) => {
    const { error }=await supabase.from('quote_items').delete().eq('id',id)
    if(error) throw error
  },
  convertQuote: async (id:string,createProject=true) => {
    const { data,error }=await supabase.rpc('admin_convert_quote',{p_quote_id:id,p_create_project:createProject})
    if(error) throw error
    return data as {order_id:string;project_id:string|null;already_converted:boolean}
  },
  decideQuote: async (id:string,status:'accepted'|'rejected') => {
    const { error } = await supabase.rpc('decide_quote',{p_quote_id:id,p_status:status})
    if(error) throw error
  },
  updateQuote: async (id:string,values:any) => {
    const { error } = await supabase.from('quotes').update(values).eq('id',id)
    if(error) throw error
  },
  projects: async () => {
    const { data,error } = await supabase.from('projects')
      .select('*,stages:project_stages(*),tasks(*)').order('updated_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  project: async (id:string) => {
    const { data,error } = await supabase.from('projects')
      .select('*,stages:project_stages(*),tasks(*,checklist:task_checklist_items(*),links:task_links(*))')
      .eq('id',id).maybeSingle()
    if(error) throw error
    return data
  },
  teamMembers: async () => {
    const { data,error } = await supabase.from('profiles')
      .select('id,email,first_name,last_name,role,status,created_at')
      .in('role',['admin','staff'])
      .order('first_name')
    if(error) throw error
    return data ?? []
  },
  allProfiles: async () => {
    const { data,error }=await supabase.from('profiles')
      .select('id,email,first_name,last_name,role,status,created_at')
      .order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  setMemberRole: async (userId:string,role:'customer'|'staff'|'admin') => {
    const { error }=await supabase.rpc('admin_set_member_role',{p_user_id:userId,p_role:role})
    if(error) throw error
  },
  saveProject: async (values:any,id?:string) => {
    const q=id?supabase.from('projects').update(values).eq('id',id):supabase.from('projects').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  saveStage: async (values:any,id?:string) => {
    const q=id?supabase.from('project_stages').update(values).eq('id',id):supabase.from('project_stages').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  deleteStage: async (id:string) => {
    const { error }=await supabase.from('project_stages').delete().eq('id',id)
    if(error) throw error
  },
  saveTask: async (values:any,id?:string) => {
    const q=id?supabase.from('tasks').update(values).eq('id',id):supabase.from('tasks').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  deleteTask: async (id:string) => {
    const { error }=await supabase.from('tasks').delete().eq('id',id)
    if(error) throw error
  },
  saveChecklistItem: async (values:any,id?:string) => {
    const q=id?supabase.from('task_checklist_items').update(values).eq('id',id):supabase.from('task_checklist_items').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  deleteChecklistItem: async (id:string) => {
    const { error }=await supabase.from('task_checklist_items').delete().eq('id',id)
    if(error) throw error
  },
  saveTaskLink: async (values:any,id?:string) => {
    const q=id?supabase.from('task_links').update(values).eq('id',id):supabase.from('task_links').insert(values)
    const { data,error }=await q.select().single()
    if(error) throw error
    return data
  },
  deleteTaskLink: async (id:string) => {
    const { error }=await supabase.from('task_links').delete().eq('id',id)
    if(error) throw error
  },
  taskActivity: async (taskId:string) => {
    const { data,error }=await supabase.from('task_activity_logs')
      .select('*').eq('task_id',taskId).order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  projectFiles: async (projectId:string) => {
    const { data,error }=await supabase.from('client_files')
      .select('*').eq('project_id',projectId).order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  assignClientFileTask: async (fileId:string,taskId:string|null) => {
    const { error }=await supabase.from('client_files').update({task_id:taskId}).eq('id',fileId)
    if(error) throw error
  },
  payments: async () => {
    const { data,error } = await supabase.from('payments')
      .select('*,order:orders(order_number),customer:profiles!payments_customer_id_fkey(id,email,first_name,last_name),receipt:payment_receipts(*)')
      .order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  paymentSettings: async () => {
    const { data,error } = await supabase.from('payment_settings').select('*').eq('id',true).maybeSingle()
    if(error) throw error
    return data
  },
  savePaymentSettings: async (values:any) => {
    const { error } = await supabase.from('payment_settings').update(values).eq('id',true)
    if(error) throw error
  },
  uploadReceipt: async (paymentId:string, customerId:string, file:File) => {
    const path=`${customerId}/${paymentId}/${crypto.randomUUID()}-${file.name}`
    const up=await supabase.storage.from('payment-receipts').upload(path,file,{upsert:false})
    if(up.error) throw up.error
    const { error }=await supabase.from('payment_receipts').insert({
      payment_id:paymentId,customer_id:customerId,storage_path:path,file_name:file.name,mime_type:file.type||'application/octet-stream'
    })
    if(error) throw error
  },
  reviewReceipt: async (id:string,status:'approved'|'rejected',note='') => {
    const { error }=await supabase.rpc('review_payment_receipt',{p_receipt_id:id,p_status:status,p_note:note||null})
    if(error) throw error
  },
  paymentReceiptUrl: async (path:string) => {
    const { data,error }=await supabase.storage.from('payment-receipts').createSignedUrl(path,600)
    if(error) throw error
    return data.signedUrl
  },
  notifications: async () => {
    const { data,error }=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(100)
    if(error) throw error
    return data ?? []
  },
  markNotification: async (id:string) => {
    const { error }=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id)
    if(error) throw error
  },
  markAllNotifications: async () => {
    const { error }=await supabase.from('notifications').update({read_at:new Date().toISOString()}).is('read_at',null)
    if(error) throw error
  },
  files: async () => {
    const { data,error }=await supabase.from('client_files').select('*').order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  addClientFile: async (values:{customer_id:string;project_id?:string|null;task_id?:string|null;order_id?:string|null;uploaded_by:string;name:string;external_url?:string|null;storage_path?:string|null;file_type?:string|null;client_visible:boolean}) => {
    const { error }=await supabase.from('client_files').insert(values)
    if(error) throw error
  },
  uploadClientFile: async (customerId:string,file:File) => {
    const path = customerId + '/' + crypto.randomUUID() + '-' + file.name
    const { error } = await supabase.storage.from('client-files').upload(path,file,{upsert:false})
    if(error) throw error
    return path
  },
  fileUrl: async (path:string) => {
    const { data,error }=await supabase.storage.from('client-files').createSignedUrl(path,600)
    if(error) throw error
    return data.signedUrl
  },
  announcements: async () => {
    const { data,error }=await supabase.from('announcements').select('*').order('published_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  createAnnouncement: async (values:any) => {
    const { error }=await supabase.from('announcements').insert(values)
    if(error) throw error
  },
  unreadCounts: async (userId:string) => {
    const [n,m] = await Promise.all([
      supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',userId).is('read_at',null),
      supabase.rpc('unread_message_count')
    ])
    if(m.error) throw m.error
    return {notifications:n.count??0,messages:Number(m.data||0)}
  },
  markConversationRead: async (conversationId:string,_userId?:string) => {
    const { error }=await supabase.rpc('mark_conversation_read_v2',{p_conversation_id:conversationId})
    if(error) throw error
  }
}
