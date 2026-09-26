import { supabase } from '../lib/supabase'

export type UserPreferences={
  user_id:string
  sidebar_expanded:boolean
  floating_chat_enabled:boolean
  updated_at:string
}

export type AppSettings={
  id:boolean
  business_name:string
  currency:string
  timezone:string
  default_project_priority:'low'|'medium'|'high'|'urgent'
  default_quote_valid_days:number
  default_client_file_visibility:boolean
  drive_upload_limit_gb:number
  updated_at:string
  updated_by:string|null
}

export const settingsApi={
  userPreferences:async():Promise<UserPreferences|null>=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)return null
    const {data,error}=await supabase.from('user_preferences')
      .select('*').eq('user_id',user.id).maybeSingle()
    if(error)throw error
    return data as UserPreferences|null
  },

  saveUserPreferences:async(values:Partial<Pick<UserPreferences,'sidebar_expanded'|'floating_chat_enabled'>>)=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)throw new Error('Sessão não encontrada.')
    const {data,error}=await supabase.from('user_preferences')
      .upsert({user_id:user.id,...values},{onConflict:'user_id'})
      .select().single()
    if(error)throw error
    return data as UserPreferences
  },

  appSettings:async():Promise<AppSettings|null>=>{
    const {data,error}=await supabase.from('app_settings').select('*').eq('id',true).maybeSingle()
    if(error)throw error
    return data as AppSettings|null
  },

  saveAppSettings:async(values:Partial<Omit<AppSettings,'id'|'updated_at'|'updated_by'>>)=>{
    const {data:{user}}=await supabase.auth.getUser()
    if(!user)throw new Error('Sessão não encontrada.')
    const {data,error}=await supabase.from('app_settings')
      .update({...values,updated_by:user.id}).eq('id',true).select().single()
    if(error)throw error
    return data as AppSettings
  },
}
