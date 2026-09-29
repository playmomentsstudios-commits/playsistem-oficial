import { supabase } from '../lib/supabase'

export type SiteSettings={
  id:boolean
  company_name:string
  description:string
  hero_headline:string
  hero_cta:string
  primary_color:string
  instagram_url:string|null
  youtube_url:string|null
  tiktok_url:string|null
  linkedin_url:string|null
  whatsapp:string|null
  contact_email:string|null
  contact_phone:string|null
  address:string|null
  city:string|null
  state:string|null
  footer_description:string|null
  home_areas_eyebrow:string
  home_areas_title:string
  meta_description:string
  updated_at:string
  updated_by:string|null
}

export type HomeServiceArea={
  id:string
  title:string
  icon:string|null
  accent_color:string
  image_url:string|null
  image_drive_file_id:string|null
  image_mime_type:string|null
  image_file_size:number|null
  href:string
  topics:string[]
  display_order:number
  active:boolean
}

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


export type SiteCampaign={
  id:string; name:string; code:string; status:'draft'|'active'|'paused'|'finished'; source:string|null; medium:string|null;
  starts_at:string|null; ends_at:string|null; notes:string|null; created_at:string; updated_at:string;
}
export type LandingSection={type:'benefits'|'content'|'proof'|'faq'|'cta'; title?:string; text?:string; items?:Array<{title:string;description?:string}>}
export type SiteLandingPage={
  id:string; campaign_id:string|null; title:string; slug:string; status:'draft'|'published'|'paused'; eyebrow:string|null;
  headline:string; subheadline:string|null; cta_label:string; cta_href:string; secondary_cta_label:string|null; secondary_cta_href:string|null;
  hero_image_url:string|null; hero_image_drive_file_id:string|null; hero_image_mime_type:string|null; hero_image_file_size:number|null;
  sections:LandingSection[]; seo_title:string|null; seo_description:string|null; canonical_url:string|null; noindex:boolean; published_at:string|null;
  campaign?:SiteCampaign|null;
}

function slugify(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
}

export const siteContentApi={
  settings:async()=>{
    const {data,error}=await supabase.from('site_settings').select('*').eq('id',true).single()
    if(error)throw error
    return data as SiteSettings
  },

  updateSettings:async(values:Partial<SiteSettings>)=>{
    const {data:{user}}=await supabase.auth.getUser()
    const {data,error}=await supabase.from('site_settings').update({...values,updated_at:new Date().toISOString(),updated_by:user?.id||null}).eq('id',true).select().single()
    if(error)throw error
    return data as SiteSettings
  },

  homeServiceAreas:async(admin=false)=>{
    let query=supabase.from('home_service_areas').select('*').order('display_order').order('title')
    if(!admin)query=query.eq('active',true)
    const {data,error}=await query
    if(error)throw error
    return (data||[]) as HomeServiceArea[]
  },

  saveHomeServiceArea:async(values:Partial<HomeServiceArea>&{title:string})=>{
    const payload={...values,updated_at:new Date().toISOString()}
    if(values.id){
      const {data,error}=await supabase.from('home_service_areas').update(payload).eq('id',values.id).select().single()
      if(error)throw error
      return data as HomeServiceArea
    }
    const {data,error}=await supabase.from('home_service_areas').insert(payload).select().single()
    if(error)throw error
    return data as HomeServiceArea
  },

  deleteHomeServiceArea:async(id:string)=>{
    const {error}=await supabase.from('home_service_areas').delete().eq('id',id)
    if(error)throw error
  },

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
,
  campaigns:async()=>{
    const {data,error}=await supabase.from('site_campaigns').select('*').order('created_at',{ascending:false})
    if(error)throw error
    return (data||[]) as SiteCampaign[]
  },

  saveCampaign:async(values:Partial<SiteCampaign>&{name:string})=>{
    const {data:{user}}=await supabase.auth.getUser()
    const payload={...values,code:values.code?.trim()||slugify(values.name),updated_at:new Date().toISOString(),updated_by:user?.id||null}
    if(values.id){const {data,error}=await supabase.from('site_campaigns').update(payload).eq('id',values.id).select().single();if(error)throw error;return data as SiteCampaign}
    const {data,error}=await supabase.from('site_campaigns').insert({...payload,created_by:user?.id||null}).select().single();if(error)throw error;return data as SiteCampaign
  },

  landingPages:async(admin=false)=>{
    let query=supabase.from('site_landing_pages').select('*,campaign:site_campaigns(*)').order('created_at',{ascending:false})
    if(!admin)query=query.eq('status','published')
    const {data,error}=await query;if(error)throw error;return (data||[]) as SiteLandingPage[]
  },

  landingPage:async(slug:string,admin=false)=>{
    let query=supabase.from('site_landing_pages').select('*,campaign:site_campaigns(*)').eq('slug',slug)
    if(!admin)query=query.eq('status','published')
    const {data,error}=await query.single();if(error)throw error;return data as SiteLandingPage
  },

  saveLandingPage:async(values:Partial<SiteLandingPage>&{title:string;headline:string})=>{
    const {data:{user}}=await supabase.auth.getUser()
    const {campaign,...rest}=values
    const payload={...rest,slug:values.slug?.trim()||slugify(values.title),updated_at:new Date().toISOString(),updated_by:user?.id||null}
    if(values.id){const {data,error}=await supabase.from('site_landing_pages').update(payload).eq('id',values.id).select().single();if(error)throw error;return data as SiteLandingPage}
    const {data,error}=await supabase.from('site_landing_pages').insert({...payload,created_by:user?.id||null}).select().single();if(error)throw error;return data as SiteLandingPage
  },

  deleteLandingPage:async(id:string)=>{
    const {error}=await supabase.from('site_landing_pages').delete().eq('id',id);if(error)throw error
  },

  uploadSiteAsset:async(file:File,section='HOME')=>{
    const {data,error}=await supabase.functions.invoke('google-drive-site-asset-upload',{body:{file_name:file.name,mime_type:file.type||'application/octet-stream',file_size:file.size,section}})
    if(error)throw error
    if(!data?.upload_url)throw new Error(data?.error||'Não foi possível iniciar o upload no Drive.')
    const uploaded=await fetch(data.upload_url,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file})
    if(!uploaded.ok)throw new Error('Não foi possível concluir o upload no Drive.')
    const driveFile=await uploaded.json()
    const base=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'')
    return {driveFileId:driveFile.id as string,url:`${base}/functions/v1/google-drive-site-asset?id=${encodeURIComponent(driveFile.id)}`,mimeType:driveFile.mimeType||file.type||null,fileSize:Number(driveFile.size||file.size)||null}
  }
}
