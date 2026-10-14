import { projectId, publicAnonKey } from '../utils/supabase/info.tsx'

const upstreamBase = 'https://' + projectId + '.supabase.co'
const noStore = {
 'Cache-Control':'private, no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'
}
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
const staticMediaTypes=['audio/mpeg','application/pdf']

async function media(request) {
 const token=new URL(request.url).searchParams.get('ticket')||''
 if(!uuid.test(token))return new Response('Acesso à mídia inválido.',{status:403,headers:noStore})
 const headers=new Headers({apikey:publicAnonKey,Authorization:'Bearer '+publicAnonKey})
 const range=request.headers.get('Range')
 if(range)headers.set('Range',range)
 try {
  const response=await fetch(upstreamBase+'/functions/v1/academy-library-media?ticket='+encodeURIComponent(token),{
   method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(45000)
  })
  if(!response.ok) {
   const code=[401,403].includes(response.status)?403:response.status===416?416:502
   return new Response('Mídia indisponível ou acesso expirado.',{status:code,headers:noStore})
  }
  const type=String(response.headers.get('Content-Type')||'').split(';')[0].toLowerCase()
  if(!staticMediaTypes.includes(type))return new Response('Formato inesperado.',{status:502,headers:noStore})
  const out=new Headers(noStore)
  out.set('Content-Type',type)
  out.set('Content-Disposition','inline')
  out.set('Accept-Ranges','bytes')
  for(const name of ['Content-Length','Content-Range','ETag','Last-Modified']){
   const value=response.headers.get(name)
   if(value)out.set(name,value)
  }
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:out})
 }catch{
  return new Response('Não foi possível carregar a mídia. Tente novamente.',{status:503,headers:noStore})
 }
}

const manifest={
 id:'/academia-sagamente',
 name:'Academia Sagamente',
 short_name:'Academia',
 description:'Sua biblioteca de audiobooks, e-books e cursos, sem distrações.',
 lang:'pt-BR',display:'standalone',display_override:['standalone'],
 start_url:'/',scope:'/',
 background_color:'#0a0a0b',theme_color:'#0a0a0b',
 categories:['education','books','entertainment'],
 icons:[
  {src:'/pwa/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
  {src:'/pwa/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
  {src:'/pwa/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}
 ],
 shortcuts:[
  {name:'Minha biblioteca',url:'/app/academia'},
  {name:'Cursos',url:'/app/academia/catalogo'}
 ]
}

const serviceWorker=`
const CACHE='academia-sagamente-static-v1'
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())})
self.addEventListener('fetch',event=>{
 const request=event.request
 if(request.method!=='GET')return
 const url=new URL(request.url)
 if(url.origin!==self.location.origin)return
 // Never cache authenticated HTML, media, PDF, video, tickets or API data.
 if(request.mode==='navigate')return
 if(url.pathname.startsWith('/assets/')&&['script','style','font','image'].includes(request.destination)){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE)
   const previous=await cache.match(request)
   if(previous)return previous
   const response=await fetch(request)
   if(response.ok&&response.type==='basic')await cache.put(request,response.clone())
   return response
  })())
 }
})
`
export default {
 async fetch(request,env) {
  if(request.method!=='GET'&&request.method!=='HEAD')return env.ASSETS.fetch(request)
  const path=new URL(request.url).pathname
  if(path==='/app/academia/midia')return media(request)
  if(path==='/academia-manifest.webmanifest')return new Response(request.method==='HEAD'?null:JSON.stringify(manifest),{
   headers:{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}
  })
  if(path==='/academy-sw.js')return new Response(request.method==='HEAD'?null:serviceWorker,{
   headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache','Service-Worker-Allowed':'/'}
  })
  const result=await env.ASSETS.fetch(request)
  if((result.headers.get('Content-Type')||'').includes('text/html')){
   const out=new Headers(result.headers)
   out.set('Cache-Control','no-store')
   out.set('X-Robots-Tag','noindex,nofollow')
   return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers:out})
  }
  return result
 }
}
