import { useEffect } from 'react'
import { useBrandAsset } from '../components/BrandImage'

export type SeoProps={
 title:string
 description:string
 image?:string|null
 canonicalPath?:string
 canonicalUrl?:string|null
 type?:'website'|'article'|'product'|'profile'
 noindex?:boolean
 jsonLd?:Record<string,unknown>|Array<Record<string,unknown>>|null
}

function upsertMeta(selector:string,attrs:Record<string,string>){
 let el=document.head.querySelector<HTMLMetaElement>(selector)
 if(!el){el=document.createElement('meta');document.head.appendChild(el)}
 Object.entries(attrs).forEach(([key,value])=>el!.setAttribute(key,value))
}
function upsertLink(rel:string,href:string){
 let el=document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
 if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el)}
 el.href=href
}
function absolute(value:string){try{return new URL(value,window.location.origin).toString()}catch{return value}}

export function useSeo({title,description,image,canonicalPath,canonicalUrl,type='website',noindex=false,jsonLd}:SeoProps){
 const fallbackSocialImage=useBrandAsset('social')
 const effectiveImage=image||fallbackSocialImage
 useEffect(()=>{
  const fullTitle=title.includes('Sagamente')?title:`${title} | Sagamente`
  const canonical=canonicalUrl?absolute(canonicalUrl):absolute(canonicalPath||window.location.pathname)
  document.title=fullTitle
  upsertMeta('meta[name="description"]',{name:'description',content:description.slice(0,160)})
  upsertMeta('meta[name="robots"]',{name:'robots',content:noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'})
  upsertMeta('meta[property="og:title"]',{property:'og:title',content:fullTitle})
  upsertMeta('meta[property="og:description"]',{property:'og:description',content:description})
  upsertMeta('meta[property="og:type"]',{property:'og:type',content:type})
  upsertMeta('meta[property="og:url"]',{property:'og:url',content:canonical})
  upsertMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'Sagamente'})
  upsertMeta('meta[property="og:locale"]',{property:'og:locale',content:'pt_BR'})
  upsertMeta('meta[name="twitter:card"]',{name:'twitter:card',content:effectiveImage?'summary_large_image':'summary'})
  upsertMeta('meta[name="twitter:title"]',{name:'twitter:title',content:fullTitle})
  upsertMeta('meta[name="twitter:description"]',{name:'twitter:description',content:description})
  if(effectiveImage){const src=absolute(effectiveImage);upsertMeta('meta[property="og:image"]',{property:'og:image',content:src});upsertMeta('meta[name="twitter:image"]',{name:'twitter:image',content:src})}
  else{document.head.querySelector('meta[property="og:image"]')?.remove();document.head.querySelector('meta[name="twitter:image"]')?.remove()}
  upsertLink('canonical',canonical)
  document.querySelectorAll('script[data-play-seo-jsonld]').forEach(el=>el.remove())
  if(jsonLd){const script=document.createElement('script');script.type='application/ld+json';script.dataset.playSeoJsonld='true';script.text=JSON.stringify(jsonLd);document.head.appendChild(script)}
 },[title,description,effectiveImage,canonicalPath,canonicalUrl,type,noindex,jsonLd])
}
