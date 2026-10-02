import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { projectId,publicAnonKey } from '../../utils/supabase/info'

type ContentType='page'|'product'|'service'|'resume'|'landing'|'course'

function normalizePath(pathname:string){
  if(pathname==='/')return '/'
  return pathname.replace(/\/+$/,'')||'/'
}

function classify(pathname:string):{content_type:ContentType;content_key:string;path:string}|null{
  const path=normalizePath(pathname)

  if(/^\/(admin|app|login|cadastro|email-confirmado|esqueci-senha|redefinir-senha|carrinho|certificados|comunidade)(\/|$)/.test(path)){
    return null
  }

  const product=path.match(/^\/produtos\/([^/]+)$/)
  if(product)return {content_type:'product',content_key:decodeURIComponent(product[1]),path}

  const service=path.match(/^\/servicos\/([^/]+)$/)
  if(service)return {content_type:'service',content_key:decodeURIComponent(service[1]),path}

  const resume=path.match(/^\/curriculos\/([^/]+)$/)
  if(resume)return {content_type:'resume',content_key:decodeURIComponent(resume[1]),path}

  const landing=path.match(/^\/l\/([^/]+)$/)
  if(landing)return {content_type:'landing',content_key:decodeURIComponent(landing[1]),path}

  const course=path.match(/^\/curso\/([^/]+)$/)
  if(course)return {content_type:'course',content_key:decodeURIComponent(course[1]),path}

  return {content_type:'page',content_key:path,path}
}

export function PublicViewTracker(){
  const location=useLocation()

  useEffect(()=>{
    const event=classify(location.pathname)
    if(!event)return

    const endpoint='https://'+projectId+'.supabase.co/functions/v1/track-public-view'

    void fetch(endpoint,{
      method:'POST',
      headers:{
        apikey:publicAnonKey,
        Authorization:'Bearer '+publicAnonKey,
        'Content-Type':'application/json',
      },
      body:JSON.stringify(event),
      keepalive:true,
    }).catch(()=>{})
  },[location.pathname])

  return null
}
