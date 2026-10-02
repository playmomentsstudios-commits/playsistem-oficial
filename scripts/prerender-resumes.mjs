import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

let base=(process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL||'').replace(/\/$/,'')
let key=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||''
if(!base||!key){
  try{
    const publicInfo=await readFile(resolve('utils/supabase/info.tsx'),'utf8')
    const projectId=publicInfo.match(/projectId\s*=\s*["']([^"']+)["']/)?.[1]||''
    const publicAnonKey=publicInfo.match(/publicAnonKey\s*=\s*["']([^"']+)["']/)?.[1]||''
    if(!base&&projectId)base='https://'+projectId+'.supabase.co'
    if(!key&&publicAnonKey)key=publicAnonKey
  }catch{}
}
const origin=(process.env.PUBLIC_SITE_URL||process.env.URL||'https://playsistem-oficial.playmomentsstudios.workers.dev').replace(/\/$/,'')
if(!base||!key){
  console.warn('[resume-prerender] Supabase config unavailable; skipping resume prerender.')
  process.exit(0)
}
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))
const response=await fetch(base+'/rest/v1/resumes?status=eq.published&select=*',{headers:{apikey:key,Authorization:'Bearer '+key}})
if(!response.ok){console.warn('[resume-prerender] Could not load resumes:',response.status);process.exit(0)}
const resumes=await response.json()
const template=await readFile(resolve('dist/index.html'),'utf8')
for(const resume of resumes){
  if(!resume?.slug)continue
  const rawTitle=resume.seo_title||[resume.display_name,resume.headline].filter(Boolean).join(' — ')||'Currículo'
  const title=rawTitle.includes('Play Moments')?rawTitle:rawTitle+' | Play Moments'
  const description=String(resume.seo_description||resume.summary||'Currículo profissional na Play Moments.').slice(0,300)
  const image=resume.seo_image_url||resume.photo_url||''
  const path='/curriculos/'+encodeURIComponent(resume.slug)
  const canonical=origin+path
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
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,'')
  html=html.replace('</head>',tags+'\n</head>')
  const dir=resolve('dist','curriculos',resume.slug)
  await mkdir(dir,{recursive:true})
  await writeFile(resolve(dir,'index.html'),html)
}
console.log('[resume-prerender] Generated',resumes.length,'resume page(s).')
