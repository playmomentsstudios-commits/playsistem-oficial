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
}
