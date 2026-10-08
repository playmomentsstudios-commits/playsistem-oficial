import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { siteContentApi, type SiteSettings } from '../services/siteContent'

export type BrandVariant='dark'|'light'|'compact'|'symbol'|'staff'|'favicon'|'social'
type AssetKey='brand_logo_dark_url'|'brand_logo_light_url'|'brand_logo_compact_url'|'brand_symbol_url'|'brand_staff_logo_url'|'brand_favicon_url'|'brand_social_image_url'
const KEYS:Record<BrandVariant,AssetKey>={
  dark:'brand_logo_dark_url',
  light:'brand_logo_light_url',
  compact:'brand_logo_compact_url',
  symbol:'brand_symbol_url',
  staff:'brand_staff_logo_url',
  favicon:'brand_favicon_url',
  social:'brand_social_image_url',
}
export const BRAND_DEFAULTS:Record<BrandVariant,string>={
  dark:'/sagamente-logo-dark.svg',
  light:'/sagamente-logo-light.svg',
  compact:'/sagamente-logo-dark.svg',
  symbol:'/sagamente-mark.svg',
  staff:'/sagamente-logo-light.svg',
  favicon:'/favicon.svg',
  social:'',
}

let cached:SiteSettings|null=null
let pending:Promise<SiteSettings>|null=null
function loadBrandSettings(){
  if(cached)return Promise.resolve(cached)
  if(!pending)pending=siteContentApi.settings().then(value=>{cached=value;return value}).finally(()=>{pending=null})
  return pending
}

/** Updating brand settings is propagated to mounted components without page reload. */
export function invalidateBrandSettings(next?:SiteSettings){
  cached=next||null
  if(typeof window!=='undefined')window.dispatchEvent(new Event('sagamente:brand-updated'))
}

export function brandAsset(settings:SiteSettings|null|undefined,variant:BrandVariant){
  const raw=settings?.[KEYS[variant]]
  const url=typeof raw==='string'?raw.trim():''
  if(url.startsWith('/')&&!url.startsWith('//'))return url
  if(/^https:\/\//i.test(url))return url
  return BRAND_DEFAULTS[variant]
}

export function useBrandAsset(variant:BrandVariant){
  const [url,setUrl]=useState(()=>brandAsset(cached,variant))
  useEffect(()=>{
    let active=true
    const refresh=()=>{setUrl(brandAsset(cached,variant));void loadBrandSettings().then(s=>{if(active)setUrl(brandAsset(s,variant))}).catch(()=>undefined)}
    refresh()
    window.addEventListener('sagamente:brand-updated',refresh)
    return()=>{active=false;window.removeEventListener('sagamente:brand-updated',refresh)}
  },[variant])
  return url
}

type Props=Omit<ImgHTMLAttributes<HTMLImageElement>,'src'> & {variant:BrandVariant}
export function BrandImage({variant,alt='Sagamente',...props}:Props){
  return <img {...props} src={useBrandAsset(variant)} alt={alt}/>
}
