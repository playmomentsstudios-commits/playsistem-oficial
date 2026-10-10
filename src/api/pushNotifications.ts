import { supabase } from '../lib/supabase'

export type PushCategories = {
  messages:boolean; projects:boolean; files:boolean; commercial:boolean; deadlines:boolean
}
export const DEFAULT_PUSH_CATEGORIES:PushCategories={
  messages:true,projects:true,files:true,commercial:true,deadlines:true,
}
type Status = {ok:boolean;publicKey:string;enabled:boolean;categories:PushCategories;devices:number}
function assertSupport() {
  if(typeof window==='undefined'||!window.isSecureContext||!('serviceWorker' in navigator)||
    !('PushManager' in window)||!('Notification' in window))
    throw new Error('Este navegador não oferece notificações Push. No iPhone, instale o Sagamente na Tela de Início e abra pelo ícone.')
}
function decodeBase64(value:string):Uint8Array<ArrayBuffer> {
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')
  const binary=atob(padded.padEnd(Math.ceil(padded.length/4)*4,'='))
  const result=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i)
  return result
}
async function call(action:string,extra:Record<string,unknown>={}) {
  const {data,error}=await supabase.functions.invoke('push-control',{body:{action,...extra}})
  if(error)throw error
  if(!data?.ok)throw new Error(String(data?.error||'Não foi possível configurar os avisos.'))
  return data
}
async function registration() {
  assertSupport()
  let current=await navigator.serviceWorker.getRegistration('/')
  if(!current)current=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
  return navigator.serviceWorker.ready
}
async function getExisting() {
  if(!('serviceWorker' in navigator))return null
  const reg=await navigator.serviceWorker.getRegistration('/')
  return reg?reg.pushManager.getSubscription():null
}
export function supportStatus() {
  const supported=typeof window!=='undefined' && window.isSecureContext
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const installed=typeof window!=='undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone))
  return {supported,installed,permission:supported?Notification.permission:'unsupported'}
}
export const pushNotificationApi={
  async status():Promise<Status> {
    assertSupport()
    const existing=await getExisting()
    return await call('status',{endpoint:existing?.endpoint||null}) as Status
  },
  async enable(categories:PushCategories=DEFAULT_PUSH_CATEGORIES) {
    assertSupport()
    // Permission MUST be requested synchronously following the user's button click.
    const permission=await Notification.requestPermission()
    if(permission!=='granted')throw new Error('Permissão não concedida. Ative os avisos nas configurações do dispositivo.')
    const reg=await registration()
    const existing=await reg.pushManager.getSubscription()
    const status=await call('status',{endpoint:existing?.endpoint||null}) as Status
    const desiredKey=decodeBase64(status.publicKey)
    const sub=existing||await reg.pushManager.subscribe({
      userVisibleOnly:true,applicationServerKey:desiredKey,
    })
    const serialized=sub.toJSON()
    if(!serialized.endpoint||!serialized.keys?.p256dh||!serialized.keys?.auth)
      throw new Error('O navegador não forneceu uma assinatura Push válida.')
    try {
      await call('subscribe',{
        subscription:{endpoint:serialized.endpoint,keys:serialized.keys},
        categories,
        deviceLabel:(navigator.userAgentData as {platform?:string}|undefined)?.platform||
          navigator.platform||'Dispositivo',
      })
    }catch(e) {
      if(!existing)await sub.unsubscribe().catch(()=>undefined)
      throw e
    }
    return sub
  },
  async updatePreferences(categories:PushCategories) {
    const sub=await getExisting()
    if(!sub)throw new Error('Ative notificações neste dispositivo primeiro.')
    await call('preferences',{endpoint:sub.endpoint,categories})
  },
  async disable() {
    const sub=await getExisting()
    if(!sub)return
    await call('unsubscribe',{endpoint:sub.endpoint})
    await sub.unsubscribe()
  },
  async unregisterCurrentDevice() {
    // Explicit sign-out must stop alerts for the previous account on shared devices.
    const sub=await getExisting()
    if(!sub)return
    try { await call('unsubscribe',{endpoint:sub.endpoint}) } finally {
      await sub.unsubscribe().catch(()=>undefined)
    }
  },
  async sendTest() {
    await call('test')
  }
}
