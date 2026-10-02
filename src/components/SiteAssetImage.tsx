import { useEffect,useMemo,useState } from 'react'
import { projectId,publicAnonKey } from '../../utils/supabase/info'

type Props={
  driveFileId?:string|null
  url?:string|null
  alt:string
  className?:string
  fallback?:React.ReactNode
}

export function siteAssetUrl(driveFileId?:string|null,url?:string|null){
  const id=String(driveFileId||'').trim()
  if(id)return 'https://'+projectId+'.supabase.co/functions/v1/google-drive-site-asset?id='+encodeURIComponent(id)
  return String(url||'').trim()||null
}

export function SiteAssetImage({driveFileId,url,alt,className='',fallback=null}:Props){
  const endpoint=useMemo(()=>siteAssetUrl(driveFileId,url),[driveFileId,url])
  const [src,setSrc]=useState<string|null>(driveFileId?null:endpoint)
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    setFailed(false)

    if(!endpoint){
      setSrc(null)
      return
    }

    if(!driveFileId){
      setSrc(endpoint)
      return
    }

    let active=true
    let objectUrl:string|null=null
    const controller=new AbortController()

    void fetch(endpoint,{
      headers:{
        apikey:publicAnonKey,
        Authorization:'Bearer '+publicAnonKey,
        Accept:'image/*',
      },
      signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw new Error('asset '+response.status)
      const blob=await response.blob()
      if(!blob.type.startsWith('image/'))throw new Error('invalid image')
      objectUrl=URL.createObjectURL(blob)
      if(active)setSrc(objectUrl)
    }).catch(()=>{
      if(active){
        setSrc(url||null)
        if(!url)setFailed(true)
      }
    })

    return()=>{
      active=false
      controller.abort()
      if(objectUrl)URL.revokeObjectURL(objectUrl)
    }
  },[endpoint,driveFileId,url])

  if(failed||!src)return <>{fallback}</>

  return <img src={src} alt={alt} className={className} onError={()=>setFailed(true)}/>
}
