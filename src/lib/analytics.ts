export type ConversionEvent=
 | 'service_interest'
 | 'product_interest'
 | 'academy_interest'
 | 'account_interest'
 | 'checkout_started'
 | 'payment_created'
 | 'payment_failed'

export function trackConversion(event:ConversionEvent,detail:Record<string,unknown>={}){
  if(typeof window==='undefined')return
  const payload={event,detail,path:window.location.pathname,at:new Date().toISOString()}
  window.dispatchEvent(new CustomEvent('playmoments:conversion',{detail:payload}))
  const target=window as Window & {dataLayer?:Array<Record<string,unknown>>}
  if(Array.isArray(target.dataLayer))target.dataLayer.push({event:'playmoments_conversion',conversion_event:event,...detail})
  void persistConversion(event,detail).catch(()=>undefined)
}


import { supabase } from './supabase'

function anonymousConversionId(){
 if(typeof window==='undefined')return null
 const key='playmoments_conversion_id';let id=window.localStorage.getItem(key)
 if(!id){id=crypto.randomUUID();window.localStorage.setItem(key,id)}return id
}

export async function persistConversion(event:ConversionEvent,detail:Record<string,unknown>={}){
 if(typeof window==='undefined')return
 const params=new URLSearchParams(window.location.search)
 const campaign=params.get('utm_campaign')||params.get('campaign')
 const safeDetail=Object.fromEntries(Object.entries(detail).filter(([k])=>!['email','phone','document_number','cpf','cnpj'].includes(k)))
 await supabase.rpc('record_conversion_event',{p_event_name:event,p_anonymous_id:anonymousConversionId(),p_path:window.location.pathname,p_campaign_code:campaign,p_detail:safeDetail})
}
