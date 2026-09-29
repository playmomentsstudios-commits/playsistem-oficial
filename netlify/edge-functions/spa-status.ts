import type { Context } from '@netlify/edge-functions'

const exactPublicRoutes=new Set([
  '/','/academia','/curso/letramento-digital','/login','/cadastro','/email-confirmado',
  '/esqueci-senha','/redefinir-senha','/produtos','/servicos','/quem-somos','/portfolio',
  '/studio','/design','/tech','/comunidade','/sobre','/contato','/carrinho',
])

const dynamicPublicRoutes=[
  /^\/produtos\/[^/]+\/?$/,
  /^\/servicos\/[^/]+\/?$/,
  /^\/portfolio\/[^/]+\/?$/,
  /^\/certificados\/[^/]+\/?$/,
  /^\/l\/[^/]+\/?$/,
]

function isKnownAppPath(pathname:string){
  const clean=pathname.length>1?pathname.replace(/\/$/,''):pathname
  if(exactPublicRoutes.has(clean))return true
  if(dynamicPublicRoutes.some(pattern=>pattern.test(pathname)))return true
  if(clean==='/app'||clean.startsWith('/app/'))return true
  if(clean==='/admin'||clean.startsWith('/admin/'))return true
  if(clean==='/sitemap.xml'||clean.startsWith('/.netlify/'))return true
  // Static assets and public files must keep their own origin status.
  if(/\/[^/]+\.[a-z0-9]{1,8}$/i.test(clean))return true
  return false
}

export default async (request:Request,context:Context)=>{
  const {pathname}=new URL(request.url)
  const response=await context.next()
  if(isKnownAppPath(pathname)||response.status!==200)return response

  // Preserve the SPA body so React renders the friendly NotFoundPage, but expose
  // the correct HTTP semantics to crawlers, caches and monitoring.
  const headers=new Headers(response.headers)
  headers.set('X-Robots-Tag','noindex, nofollow')
  headers.set('Cache-Control','no-store')
  return new Response(response.body,{status:404,statusText:'Not Found',headers})
}

export const config={path:'/*'}
