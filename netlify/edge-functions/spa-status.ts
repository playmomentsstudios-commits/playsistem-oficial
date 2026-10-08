import type { Context } from '@netlify/edge-functions'

const exactPublicRoutes=new Set([
  '/','/academia','/curso/letramento-digital','/login','/cadastro','/email-confirmado',
  '/esqueci-senha','/redefinir-senha','/produtos','/servicos','/instalar','/quem-somos','/portfolio',
  '/studio','/design','/tech','/comunidade','/sobre','/contato','/carrinho',
])

const dynamicPublicRoutes=[
  /^\/produtos\/[^/]+\/?$/,
  /^\/servicos\/[^/]+\/?$/,
  /^\/portfolio\/[^/]+\/?$/,
  /^\/certificados\/[^/]+\/?$/,
  /^\/l\/[^/]+\/?$/,
  /^\/curriculos\/[^/]+\/?$/,
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

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))}

async function resumeSeo(request:Request,response:Response){
  const url=new URL(request.url)
  const match=url.pathname.match(/^\/curriculos\/([^/]+)\/?$/)
  if(!match||response.status!==200)return response
  const env=(globalThis as any).Netlify?.env
  const supabaseUrl=env?.get?.('VITE_SUPABASE_URL')||env?.get?.('SUPABASE_URL')
  const anonKey=env?.get?.('VITE_SUPABASE_ANON_KEY')||env?.get?.('SUPABASE_ANON_KEY')
  if(!supabaseUrl||!anonKey)return response
  try{
    const endpoint=supabaseUrl.replace(/\/$/,'')+'/rest/v1/resumes?slug=eq.'+encodeURIComponent(decodeURIComponent(match[1]))+'&status=eq.published&select=display_name,headline,summary,seo_title,seo_description,seo_image_url,photo_url&limit=1'
    const data=await fetch(endpoint,{headers:{apikey:anonKey,Authorization:'Bearer '+anonKey}}).then(r=>r.ok?r.json():[])
    const resume=Array.isArray(data)?data[0]:null
    if(!resume)return response
    const rawTitle=resume.seo_title||[resume.display_name,resume.headline].filter(Boolean).join(' — ')||'Currículo'
    const title=rawTitle.includes('Play Moments')?rawTitle:rawTitle+' | Play Moments'
    const description=String(resume.seo_description||resume.summary||'Currículo profissional na Play Moments.').slice(0,300)
    const image=resume.seo_image_url||resume.photo_url||''
    const canonical=url.origin+url.pathname.replace(/\/$/,'')
    const tags=[
      '<title>'+escapeHtml(title)+'</title>',
      '<meta name="description" content="'+escapeHtml(description.slice(0,160))+'">',
      '<meta property="og:title" content="'+escapeHtml(title)+'">',
      '<meta property="og:description" content="'+escapeHtml(description)+'">',
      '<meta property="og:type" content="profile">',
      '<meta property="og:url" content="'+escapeHtml(canonical)+'">',
      '<meta property="og:site_name" content="Play Moments">',
      '<meta property="og:locale" content="pt_BR">',
      image?'<meta property="og:image" content="'+escapeHtml(image)+'">':'',
      '<meta name="twitter:card" content="'+(image?'summary_large_image':'summary')+'">',
      '<meta name="twitter:title" content="'+escapeHtml(title)+'">',
      '<meta name="twitter:description" content="'+escapeHtml(description)+'">',
      image?'<meta name="twitter:image" content="'+escapeHtml(image)+'">':'',
      '<link rel="canonical" href="'+escapeHtml(canonical)+'">',
    ].filter(Boolean).join('\n')
    let html=await response.text()
    html=html.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,'').replace(/<link\s+rel=["']canonical["'][^>]*>/gi,'')
    html=html.replace('</head>',tags+'\n</head>')
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('Cache-Control','public, max-age=0, s-maxage=300')
    return new Response(html,{status:response.status,statusText:response.statusText,headers})
  }catch{return response}
}

export default async (request:Request,context:Context)=>{
  const {pathname}=new URL(request.url)
  const response=await context.next()
  if(/^\/curriculos\/[^/]+\/?$/.test(pathname))return resumeSeo(request,response)
  if(isKnownAppPath(pathname)||response.status!==200)return response

  // Preserve the SPA body so React renders the friendly NotFoundPage, but expose
  // the correct HTTP semantics to crawlers, caches and monitoring.
  const headers=new Headers(response.headers)
  headers.set('X-Robots-Tag','noindex, nofollow')
  headers.set('Cache-Control','no-store')
  return new Response(response.body,{status:404,statusText:'Not Found',headers})
}

export const config={path:'/*'}
