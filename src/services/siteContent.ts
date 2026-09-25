import { supabase } from '../lib/supabase'

export type SiteProfile={
  id:boolean
  display_name:string
  headline:string
  eyebrow:string
  intro:string
  story:string
  objective:string
  photo_url:string|null
  resume_url:string|null
  market_since:number
  projects_delivered_label:string
  clients_served_label:string
  satisfaction_label:string
  skills:string[]
  experience:Array<{title:string;role:string;description:string}>
  tools:Array<{group:string;items:string[]}>
  methods:Array<{title:string;description:string}>
  solutions:Array<{title:string;description:string}>
  updated_at:string
  updated_by:string|null
}

export type PortfolioCategory={
  id:string
  name:string
  slug:string
  display_order:number
  active:boolean
}

export type PortfolioItem={
  id:string
  category_id:string|null
  title:string
  slug:string
  client:string|null
  short_description:string|null
  description:string|null
  cover_url:string|null
  project_url:string|null
  year:number|null
  featured:boolean
  active:boolean
  display_order:number
  category?:PortfolioCategory|null
}

function slugify(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
}

export const siteContentApi={
  profile:async()=>{
    const {data,error}=await supabase.from('site_profile').select('*').eq('id',true).single()
    if(error)throw error
    return data as SiteProfile
  },

  updateProfile:async(values:Partial<SiteProfile>)=>{
    const {data:{user}}=await supabase.auth.getUser()
    const {data,error}=await supabase.from('site_profile')
      .update({...values,updated_at:new Date().toISOString(),updated_by:user?.id||null})
      .eq('id',true).select().single()
    if(error)throw error
    return data as SiteProfile
  },

  portfolioCategories:async(admin=false)=>{
    let query=supabase.from('portfolio_categories').select('*').order('display_order').order('name')
    if(!admin)query=query.eq('active',true)
    const {data,error}=await query
    if(error)throw error
    return (data||[]) as PortfolioCategory[]
  },

  portfolioItems:async(admin=false)=>{
    let query=supabase.from('portfolio_items')
      .select('*,category:portfolio_categories(id,name,slug,display_order,active)')
      .order('display_order').order('created_at',{ascending:false})
    if(!admin)query=query.eq('active',true)
    const {data,error}=await query
    if(error)throw error
    return (data||[]) as PortfolioItem[]
  },

  saveCategory:async(values:Partial<PortfolioCategory>&{name:string})=>{
    const payload={...values,slug:values.slug?.trim()||slugify(values.name)}
    if(values.id){
      const {data,error}=await supabase.from('portfolio_categories').update(payload).eq('id',values.id).select().single()
      if(error)throw error
      return data
    }
    const {data,error}=await supabase.from('portfolio_categories').insert(payload).select().single()
    if(error)throw error
    return data
  },

  deleteCategory:async(id:string)=>{
    const {error}=await supabase.from('portfolio_categories').delete().eq('id',id)
    if(error)throw error
  },

  savePortfolioItem:async(values:Partial<PortfolioItem>&{title:string})=>{
    const {category,...rest}=values as any
    const payload={...rest,slug:values.slug?.trim()||slugify(values.title)}
    if(values.id){
      const {data,error}=await supabase.from('portfolio_items').update(payload).eq('id',values.id).select().single()
      if(error)throw error
      return data
    }
    const {data,error}=await supabase.from('portfolio_items').insert(payload).select().single()
    if(error)throw error
    return data
  },

  deletePortfolioItem:async(id:string)=>{
    const {error}=await supabase.from('portfolio_items').delete().eq('id',id)
    if(error)throw error
  },

  uploadSiteAsset:async(file:File,folder='general')=>{
    const ext=file.name.includes('.')?'.'+file.name.split('.').pop():''
    const path=folder+'/'+crypto.randomUUID()+ext
    const {error}=await supabase.storage.from('site-assets').upload(path,file,{upsert:false})
    if(error)throw error
    const {data}=supabase.storage.from('site-assets').getPublicUrl(path)
    return data.publicUrl
  },
}
