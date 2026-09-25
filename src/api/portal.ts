import { supabase } from '../lib/supabase'

export const portalApi = {
  customers: async () => {
    const { data, error } = await supabase.from('profiles')
      .select('id,email,first_name,last_name,phone,status,created_at')
      .eq('role','customer').order('created_at',{ascending:false})
    if (error) throw error
    return data ?? []
  },
  updateProfile: async (id:string, values:{first_name:string;last_name:string;phone:string|null}) => {
    const { error } = await supabase.from('profiles').update(values).eq('id',id)
    if (error) throw error
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
  quotes: async () => {
    const { data,error } = await supabase.from('quotes')
      .select('*,items:quote_items(*)').order('created_at',{ascending:false})
    if(error) throw error
    return data ?? []
  },
  quote: async (id:string) => {
    const { data,error } = await supabase.from('quotes')
      .select('*,items:quote_items(*)').eq('id',id).maybeSingle()
    if(error) throw error
    return data
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
  saveProject: async (values:any,id?:string) => {
    const q=id?supabase.from('projects').update(values).eq('id',id):supabase.from('projects').insert(values)
    const { error }=await q
    if(error) throw error
  },
  saveTask: async (values:any,id?:string) => {
    const q=id?supabase.from('tasks').update(values).eq('id',id):supabase.from('tasks').insert(values)
    const { error }=await q
    if(error) throw error
  },
  payments: async () => {
    const { data,error } = await supabase.from('payments')
      .select('*,order:orders(order_number),receipt:payment_receipts(*)').order('created_at',{ascending:false})
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
  addClientFile: async (values:{customer_id:string;project_id?:string|null;order_id?:string|null;uploaded_by:string;name:string;external_url?:string|null;storage_path?:string|null;file_type?:string|null;client_visible:boolean}) => {
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
      supabase.from('messages').select('id',{count:'exact',head:true}).neq('sender_id',userId).is('read_at',null)
    ])
    return {notifications:n.count??0,messages:m.count??0}
  },
  markConversationRead: async (conversationId:string,userId:string) => {
    const { error }=await supabase.from('messages').update({read_at:new Date().toISOString()})
      .eq('conversation_id',conversationId).neq('sender_id',userId).is('read_at',null)
    if(error) throw error
  }
}
