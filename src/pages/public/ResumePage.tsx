import { useEffect,useMemo,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { siteContentApi,type Resume } from '../../services/siteContent'
import { projectId,publicAnonKey } from '../../../utils/supabase/info'
import { useSeo } from '../../lib/seo'
import { SiteAssetImage,siteAssetUrl } from '../../components/SiteAssetImage'

function externalUrl(value?:string|null){
  if(!value)return null
  const trimmed=value.trim()
  if(!trimmed)return null
  return /^https?:\/\//i.test(trimmed)?trimmed:'https://'+trimmed
}

function instagramUrl(value?:string|null){
  if(!value)return null
  const handle=value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/^@/,'').replace(/\/$/,'')
  return handle?'https://instagram.com/'+handle:null
}

function whatsappUrl(value?:string|null){
  const digits=(value||'').replace(/\D/g,'')
  if(!digits)return null
  const normalized=digits.startsWith('55')?digits:'55'+digits
  return 'https://wa.me/'+normalized
}

function textParagraphs(value?:string|null){
  return String(value||'').split(/\n\s*\n/).map(item=>item.trim()).filter(Boolean)
}

function formatDate(value?:string|null){
  if(!value)return null
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return null
  return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric'}).format(date).replace('.','')
}

export function ResumePage(){
  const {slug=''}=useParams()
  const [resume,setResume]=useState<Resume|null>(null)
  const [loading,setLoading]=useState(true)
  const [downloadingPdf,setDownloadingPdf]=useState(false)
  const [pdfError,setPdfError]=useState('')

  useEffect(()=>{
    let active=true
    setLoading(true)
    siteContentApi.resume(slug)
      .then(row=>{if(active)setResume(row)})
      .catch(()=>{if(active)setResume(null)})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[slug])


  const seoTitle=resume?.seo_title||[resume?.display_name,resume?.headline].filter(Boolean).join(' — ')||'Currículo'
  const seoDescription=resume?.seo_description||resume?.summary||'Currículo profissional na Play Moments.'
  useSeo({title:seoTitle,description:seoDescription,image:resume?.seo_image_url||siteAssetUrl(resume?.photo_drive_file_id,resume?.photo_url)||undefined,canonicalPath:'/curriculos/'+slug,type:'profile',noindex:!resume})

  const contacts=useMemo(()=>{
    if(!resume)return[]
    const whatsapp=whatsappUrl(resume.whatsapp||resume.contact_phone)
    const emailHref=resume.contact_email?'mailto:'+resume.contact_email+'?subject='+encodeURIComponent('Contato profissional via currículo'):null
    return[
      resume.contact_email?{label:'E-mail',value:resume.contact_email,href:emailHref,action:'Escrever e-mail'}:null,
      resume.contact_phone?{label:'Contato',value:resume.contact_phone,href:'tel:'+resume.contact_phone.replace(/[^\d+]/g,''),action:'Ligar'}:null,
      whatsapp?{label:'WhatsApp',value:'Conversar pelo WhatsApp',href:whatsapp,action:'Abrir WhatsApp'}:null,
      resume.instagram?{label:'Instagram',value:resume.instagram,href:instagramUrl(resume.instagram),action:'Abrir perfil'}:null,
      resume.linkedin_url?{label:'LinkedIn',value:'Perfil profissional',href:externalUrl(resume.linkedin_url),action:'Abrir perfil'}:null,
      resume.website_url?{label:'Site',value:resume.website_url.replace(/^https?:\/\//,''),href:externalUrl(resume.website_url),action:'Abrir site'}:null,
    ].filter(Boolean) as Array<{label:string;value:string;href:string|null;action:string}>
  },[resume])

  if(loading){
    return <div className="min-h-screen bg-[#ece9e2] flex items-center justify-center text-[#171717]"><div className="w-9 h-9 rounded-full border-2 border-[#171717] border-t-transparent animate-spin"/></div>
  }

  if(!resume){
    return <div className="min-h-screen bg-[#ece9e2] text-[#171717] flex items-center justify-center px-6"><div className="max-w-md text-center"><p className="text-xs uppercase tracking-[.3em] text-black/45">Currículo</p><h1 className="text-4xl font-black mt-4">Página indisponível</h1><p className="text-sm text-black/55 mt-4">Este currículo não está publicado ou o endereço não existe.</p><Link to="/" className="inline-flex mt-7 px-5 py-3 rounded-full bg-[#171717] text-white text-sm font-semibold">Voltar ao site</Link></div></div>
  }

  const summary=textParagraphs(resume.summary)
  const identity=textParagraphs(resume.identity_text)
  const experiences=(resume.experience||[]).filter(item=>item?.title||item?.role||item?.description)
  const hasSkills=Array.isArray(resume.skills)&&resume.skills.length>0
  const initials=(resume.display_name||'CV').split(/\s+/).filter(Boolean).slice(0,2).map(item=>item.charAt(0)).join('').toUpperCase()
  const updated=formatDate(resume.updated_at)

  function pdfFilename(){
    const name=resume?.display_name||'Felipe Costa Souza'
    const professionalTitle=resume?.headline||'Designer e Comunicador'
    const label=resume?.resume_type==='mini'?'Minicurriculo':'Curriculo'
    return [label,name,professionalTitle]
      .join(' - ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'-')
      .replace(/^-|-$/g,'')
      .replace(/-+/g,'-')
      +'.pdf'
  }

  async function downloadResume(){
    if(downloadingPdf||!resume)return
    setDownloadingPdf(true)
    setPdfError('')
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),15000)
    try{
      const supabaseBase=(import.meta.env.VITE_SUPABASE_URL||('https://'+projectId+'.supabase.co')).replace(/\/$/,'')
      const endpoint=supabaseBase+'/functions/v1/resume-pdf?slug='+encodeURIComponent(slug)
      const response=await fetch(endpoint,{
        signal:controller.signal,
        headers:{
          apikey:publicAnonKey,
          Authorization:'Bearer '+publicAnonKey,
          Accept:'application/pdf',
        },
      })
      if(!response.ok){
        let message='Não foi possível gerar o PDF.'
        try{
          const payload=await response.json()
          if(payload?.error)message=String(payload.error)
        }catch{}
        throw new Error(message)
      }
      const contentType=response.headers.get('content-type')||''
      if(!contentType.includes('application/pdf'))throw new Error('O servidor não retornou um PDF válido.')

      const blob=await response.blob()
      const url=URL.createObjectURL(blob)
      const link=document.createElement('a')
      link.href=url
      link.download=pdfFilename()
      link.rel='noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(()=>URL.revokeObjectURL(url),1500)
    }catch(error:any){
      const message=error?.name==='AbortError'
        ?'A geração do PDF demorou mais que o esperado. Tente novamente.'
        :(error?.message||'Não foi possível baixar o PDF.')
      setPdfError(message)
    }finally{
      window.clearTimeout(timeout)
      setDownloadingPdf(false)
    }
  }

  return <div className="resume-page min-h-screen bg-[#ece9e2] text-[#171717] selection:bg-[#171717] selection:text-white">
    <div className="resume-screen-actions sticky top-0 z-30 border-b border-black/10 bg-[#ece9e2]/95 backdrop-blur">
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 min-h-16 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.24em] font-bold text-black/45">Documento profissional</p>
          <p className="text-xs text-black/60 mt-0.5">{resume.resume_type==='mini'?'Minicurrículo':'Currículo'}</p>
        </div>
        <button disabled={downloadingPdf} onClick={()=>void downloadResume()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#171717] px-4 sm:px-5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 disabled:cursor-wait">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {downloadingPdf?'Preparando PDF...':'Baixar currículo'}
        </button>
      </div>
    </div>

    {pdfError&&<div className="resume-screen-actions border-b border-[#b80f1c]/15 bg-[#fff4f4] text-[#8b1018]">
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-2.5 flex items-start justify-between gap-3">
        <p className="text-xs sm:text-sm leading-relaxed">{pdfError}</p>
        <button type="button" onClick={()=>setPdfError('')} className="shrink-0 text-xs font-bold underline underline-offset-2">Fechar</button>
      </div>
    </div>}

    <main className="resume-document max-w-[1040px] mx-auto sm:px-6 sm:py-7">
      <article className="bg-[#fbfaf7] sm:rounded-[28px] sm:border sm:border-black/10 sm:shadow-[0_24px_80px_rgba(20,20,20,.10)] overflow-hidden">
        <section className="resume-section px-5 py-7 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[.18em] font-bold text-black/45">
            <span>{resume.eyebrow||'Currículo profissional'}</span>
            {resume.location&&<><span className="w-1 h-1 rounded-full bg-[#b80f1c]"/><span>{resume.location}</span></>}
            {resume.market_since&&<><span className="w-1 h-1 rounded-full bg-[#b80f1c]"/><span>Atuação desde {resume.market_since}</span></>}
          </div>

          <div className="mt-6 md:hidden">
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 items-start">
              <div className="aspect-[4/5] rounded-[18px] overflow-hidden bg-[#171717] border border-black/10 shadow-[0_10px_30px_rgba(20,20,20,.08)]">
                {(resume.photo_url||resume.photo_drive_file_id)?<SiteAssetImage driveFileId={resume.photo_drive_file_id} url={resume.photo_url} alt={resume.display_name||'Foto profissional'} className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center text-4xl font-black text-white/15">{initials}</div>}/>:<div className="w-full h-full flex items-center justify-center text-4xl font-black text-white/15">{initials}</div>}
              </div>
              <div className="min-w-0 pt-1">
                {resume.display_name&&<h1 className="text-[2rem] leading-[.98] tracking-[-.045em] font-black break-words">{resume.display_name}</h1>}
                {resume.headline&&<p className="mt-3 text-[14px] leading-[1.35] font-semibold text-black/76">{resume.headline}</p>}
                {resume.callout&&<p className="mt-3 text-[13px] leading-[1.45] text-black/58">{resume.callout}</p>}
              </div>
            </div>
          </div>

          <div className="hidden md:grid mt-7 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_250px] gap-7 md:gap-10 items-start">
            <div>
              {resume.display_name&&<h1 className="text-[clamp(3rem,7vw,5.7rem)] leading-[.91] tracking-[-.055em] font-black max-w-3xl">{resume.display_name}</h1>}
              {resume.headline&&<p className="mt-5 text-xl lg:text-2xl leading-snug font-semibold max-w-2xl text-black/78">{resume.headline}</p>}
              {resume.callout&&<blockquote className="mt-6 max-w-2xl border-l-[3px] border-[#b80f1c] pl-5 text-base leading-relaxed text-black/65">{resume.callout}</blockquote>}
            </div>

            <div className="w-full">
              <div className="aspect-[4/5] rounded-[20px] overflow-hidden bg-[#171717] border border-black/10">
                {(resume.photo_url||resume.photo_drive_file_id)?<SiteAssetImage driveFileId={resume.photo_drive_file_id} url={resume.photo_url} alt={resume.display_name||'Foto profissional'} className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center text-7xl font-black text-white/15">{initials}</div>}/>:<div className="w-full h-full flex items-center justify-center text-7xl font-black text-white/15">{initials}</div>}
              </div>
            </div>
          </div>
        </section>

        {summary.length>0&&<section className="resume-section resume-rule px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
          <div className="grid md:grid-cols-[170px_1fr] gap-4 md:gap-8">
            <div><p className="resume-kicker">Perfil</p></div>
            <div className="space-y-4 max-w-3xl">
              {summary.map((paragraph,index)=><p key={index} className="text-[16px] sm:text-[17px] leading-[1.7] text-black/78">{paragraph}</p>)}
            </div>
          </div>
        </section>}

        {experiences.length>0&&<section className="resume-section resume-rule px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
          <div className="grid md:grid-cols-[170px_1fr] gap-5 md:gap-8">
            <div>
              <p className="resume-kicker">Participações & projetos</p>
              <p className="mt-2 text-xs leading-relaxed text-black/45">Projetos selecionados em design, comunicação, cultura e território.</p>
            </div>
            <div className="space-y-0 max-w-3xl">
              {experiences.map((item,index)=><div key={index} className="resume-experience relative pl-6 pb-6 last:pb-0">
                <span className="absolute left-0 top-[7px] w-2.5 h-2.5 rounded-full bg-[#b80f1c]"/>
                <span className="absolute left-[4px] top-5 bottom-0 w-px bg-black/10 last:hidden"/>
                {item.title&&<h3 className="text-base sm:text-[17px] font-bold leading-snug">{item.title}</h3>}
                {item.role&&<p className="mt-1 text-xs sm:text-sm font-semibold text-[#9f111b]">{item.role}</p>}
                {item.description&&<p className="mt-2 text-sm sm:text-[15px] leading-[1.65] text-black/62">{item.description}</p>}
              </div>)}
            </div>
          </div>
        </section>}

        {hasSkills&&<section className="resume-section resume-rule px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
          <div className="grid md:grid-cols-[170px_1fr] gap-4 md:gap-8">
            <div><p className="resume-kicker">Áreas de atuação</p></div>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map(skill=><span key={skill} className="px-3 py-2 rounded-full border border-black/12 bg-black/[.025] text-xs sm:text-sm font-semibold text-black/68">{skill}</span>)}
            </div>
          </div>
        </section>}

        {identity.length>0&&<section className="resume-section resume-rule px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
          <div className="grid md:grid-cols-[170px_1fr] gap-4 md:gap-8">
            <div>
              <p className="resume-kicker">Identidade & território</p>
              <div className="mt-3 w-8 h-[3px] bg-[#b80f1c]"/>
            </div>
            <div className="space-y-4 max-w-3xl">
              {identity.map((paragraph,index)=><p key={index} className="text-[15px] sm:text-base leading-[1.75] text-black/72">{paragraph}</p>)}
            </div>
          </div>
        </section>}


        {contacts.length>0&&<section className="resume-section resume-rule px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
          <div className="grid md:grid-cols-[170px_1fr] gap-5 md:gap-8">
            <div><p className="resume-kicker">Contato</p></div>
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-3xl">
              {contacts.map(item=>item.href?<a key={item.label} href={item.href} target={item.href.startsWith('http')?'_blank':undefined} rel={item.href.startsWith('http')?'noreferrer':undefined} className="resume-contact group rounded-2xl border border-black/10 px-4 py-3.5 hover:border-black/25 hover:bg-black/[.025]">
                <span className="block text-[9px] uppercase tracking-[.18em] font-bold text-black/38">{item.label}</span>
                <span className="block mt-1 text-sm font-semibold break-all text-black/78">{item.value}</span>
                <span className="resume-contact-action inline-flex mt-2 text-[11px] font-bold text-[#9f111b]">{item.action} →</span>
              </a>:null)}
            </div>
          </div>
        </section>}

        <footer className="resume-footer px-5 py-5 sm:px-9 lg:px-12 border-t border-black/10 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[9px] uppercase tracking-[.16em] text-black/38">
          <span>Minicurrículo profissional</span>
          {updated&&<span>Atualizado em {updated}</span>}
        </footer>
      </article>

      <div className="resume-screen-actions px-5 py-7 sm:px-0 flex justify-center">
        <button disabled={downloadingPdf} onClick={()=>void downloadResume()} className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#171717] px-6 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-wait">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {downloadingPdf?'Preparando PDF...':'Baixar currículo em PDF'}
        </button>
      </div>
    </main>
  </div>
}
