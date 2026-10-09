import { projectId, publicAnonKey } from '../utils/supabase/info.tsx'
import commercialLandings from '../src/data/seoCommercialLandings.json'

// Only actual public routes are mapped here. A database entry alone must never
// turn a private or nonexistent application route into a search result.
export const PUBLIC_SEO_ROUTES = new Set([
 '/', '/produtos', '/equipamentos', '/servicos', '/academia',
 '/curso/letramento-digital', '/quem-somos', '/studio', '/design', '/tech',
 '/contato', '/instalar',
 ...Object.keys(commercialLandings)
])

const API_BASE = 'https://' + projectId + '.supabase.co/rest/v1'
const PUBLIC_HEADERS = { apikey:publicAnonKey, Authorization:'Bearer '+publicAnonKey }
const SEOMETA='title,description,noindex,published,path,canonical_url,og_image_url'
const toSafeText = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const safeAbsolute = raw => {
 try {const url=new URL(raw);return url.protocol==='https:'?url.href:null} catch{return null}
}
const coreHeaders = {'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=180, s-maxage=180','X-Content-Type-Options':'nosniff'}

const renderLandingContent=(page)=>{
  const h=toSafeText
  const offers=page.offers.map(offer=>'<li><a href="/servicos/'+encodeURIComponent(offer.slug)+'">'+h(offer.name)+'</a> — '+h(offer.text)+'</li>').join('')
  const benefits=page.benefits.map(item=>'<li>'+h(item)+'</li>').join('')
  const questions=page.faq.map(item=>'<dt>'+h(item.question)+'</dt><dd>'+h(item.answer)+'</dd>').join('')
  return '<main style="background:#0b0b0d;color:#f0f0f2;padding:2rem;min-height:70vh;font-family:system-ui,sans-serif">'
    +'<div style="max-width:900px;margin:auto">'
    +'<nav aria-label="Navegação"><a href="/" style="color:#dca777">Sagamente</a> / <a href="/servicos" style="color:#dca777">Serviços</a></nav>'
    +'<p>'+h(page.area)+'</p>'
    +'<h1>'+h(page.heading)+'</h1>'
    +'<p>'+h(page.intro)+'</p>'
    +'<p><a href="#opcoes" style="color:#eeb889">Conhecer serviços disponíveis</a> · <a href="/contato" style="color:#eeb889">Solicitar orçamento</a></p>'
    +'<h2>O que considerar antes de contratar</h2><ul>'+benefits+'</ul>'
    +'<h2>'+h(page.fitTitle)+'</h2><p>'+h(page.fitText)+'</p>'
    +'<section id="opcoes"><h2>Escolha uma oferta do catálogo</h2><ul>'+offers+'</ul></section>'
    +'<h2>Como começar seu projeto</h2><ol>'+page.steps.map(item=>'<li>'+h(item)+'</li>').join('')+'</ol>'
    +'<h2>Dúvidas frequentes</h2><dl>'+questions+'</dl>'
    +'<p><a href="/contato" style="color:#eeb889">Conversar sobre meu projeto</a></p>'
    +'</div></main>'
}
const landingSchema=(page,origin)=>JSON.stringify({
  '@context':'https://schema.org','@graph':[
    {'@type':'Service',name:page.heading,description:page.intro,url:origin+page.path,provider:{'@type':'Organization',name:'Sagamente',url:origin}},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Início',item:origin+'/'},
      {'@type':'ListItem',position:2,name:'Serviços',item:origin+'/servicos'},
      {'@type':'ListItem',position:3,name:page.area,item:origin+page.path}
    ]}
  ]
}).replace(/</g,'\\u003c')

async function querySeo(query){
 const result=await fetch(API_BASE+'/seo_pages?'+query,{
  headers:PUBLIC_HEADERS,signal:AbortSignal.timeout(3200)
 })
 if(!result.ok)throw new Error('SEO configuration request failed')
 return result.json()
}
export async function seoPage(path){
 if(!PUBLIC_SEO_ROUTES.has(path))return null
 try{
  const list=await querySeo('select='+encodeURIComponent(SEOMETA)+'&path=eq.'+encodeURIComponent(path)+'&published=eq.true&limit=1')
  return Array.isArray(list)?list[0]||null:null
 }catch{return null}
}
export async function serveSeoSitemap(request){
 const origin=new URL(request.url).origin
 let items=[]
 try{
  const list=await querySeo('select=path,updated_at&published=eq.true&noindex=eq.false&order=path.asc')
  items=(Array.isArray(list)?list:[]).filter(p=>PUBLIC_SEO_ROUTES.has(p.path)&&p.path!=='/equipamentos')
 }catch{
  // A failed backend lookup must not fabricate sitemap entries.
  return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})
 }
 const body='<?xml version="1.0" encoding="UTF-8"?>\n'
  +'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  +items.map(p=>'<url><loc>'+toSafeText(origin+p.path)+'</loc>'
   +(p.updated_at&&!Number.isNaN(Date.parse(p.updated_at))?'<lastmod>'+new Date(p.updated_at).toISOString().slice(0,10)+'</lastmod>':'')
   +'</url>').join('')
  +'</urlset>'
 return new Response(request.method==='HEAD'?null:body,{status:200,headers:coreHeaders})
}
export function serveSeoRobots(request){
 const origin=new URL(request.url).origin
 const body=[
  'User-agent: *','Allow: /',
  'Disallow: /admin/','Disallow: /app/','Disallow: /login',
  'Disallow: /cadastro','Disallow: /esqueci-senha','Disallow: /redefinir-senha',
  'Disallow: /carrinho','Disallow: /email-confirmado',
  'Sitemap: '+origin+'/sitemap.xml',''
 ].join('\n')
 return new Response(request.method==='HEAD'?null:body,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}})
}

const SEO_REWRITE_TAGS = [
 'title',
 'meta[name="description"]',
 'meta[name="robots"]',
 'meta[property="og:title"]',
 'meta[property="og:description"]',
 'meta[property="og:type"]',
 'meta[property="og:url"]',
 'meta[property="og:site_name"]',
 'meta[property="og:locale"]',
 'meta[property="og:image"]',
 'meta[name="twitter:card"]',
 'meta[name="twitter:title"]',
 'meta[name="twitter:description"]',
 'meta[name="twitter:image"]',
 'link[rel="canonical"]'
]

export function rewriteSeoHtml(response,row,request){
 if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response
 const origin=new URL(request.url).origin
 const url=safeAbsolute(row.canonical_url)||origin+row.path
 const robots=row.noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
 const title=toSafeText(row.title)
 const desc=toSafeText(row.description)
 const absoluteUrl=toSafeText(url)
 const image=row.og_image_url&&safeAbsolute(row.og_image_url)
 const metas=[
  '<title>'+title+'</title>',
  '<meta name="description" content="'+desc+'">',
  '<meta name="robots" content="'+robots+'">',
  '<link rel="canonical" href="'+absoluteUrl+'">',
  '<meta property="og:title" content="'+title+'">',
  '<meta property="og:description" content="'+desc+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="'+absoluteUrl+'">',
  '<meta property="og:site_name" content="Sagamente">',
  '<meta property="og:locale" content="pt_BR">',
  '<meta name="twitter:card" content="'+(image?'summary_large_image':'summary')+'">',
  '<meta name="twitter:title" content="'+title+'">',
  '<meta name="twitter:description" content="'+desc+'">',
 ]
 if(image){
  metas.push('<meta property="og:image" content="'+toSafeText(image)+'">')
  metas.push('<meta name="twitter:image" content="'+toSafeText(image)+'">')
 }
 if(row.path==='/'){
  const ld=JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:'Sagamente',url:origin})
  metas.push('<script type="application/ld+json">'+ld.replace(/</g,'\\u003c')+'</script>')
 }
 const landing=commercialLandings[row.path]
 if(landing)metas.push('<script type="application/ld+json">'+landingSchema(landing,origin)+'</script>')
 const rewriter=new HTMLRewriter().on('head',{element(e){e.append(metas.join('\n'),{html:true})}})
 for(const selector of SEO_REWRITE_TAGS)rewriter.on(selector,{element(e){e.remove()}})
 if(landing){
  // Visible, real page copy in initial HTML (also rendered in the React page).
  // This is not hidden keyword stuffing or bot-only content.
  rewriter.on('div#root',{element(e){e.prepend(renderLandingContent(landing),{html:true})}})
 }
 return rewriter.transform(response)
}

export function isPrivateSeoRoute(path){
 return /^\/(admin|app)(\/|$)/.test(path)
  || /^\/(login|cadastro|email-confirmado|esqueci-senha|redefinir-senha|carrinho)(\/|$)/.test(path)
}
export function preventIndexing(response){
 if(!(response.headers.get('content-type')||'').includes('text/html'))return response
 const rewriter=new HTMLRewriter()
  .on('meta[name="robots"]',{element(e){e.setAttribute('content','noindex,nofollow')}})
 return rewriter.transform(response)
}
