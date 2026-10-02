import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { siteContentApi, type Resume } from '../../services/siteContent'

function externalUrl(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed
}

function instagramUrl(value?: string | null) {
  if (!value) return null
  const handle = value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '')
  return handle ? 'https://instagram.com/' + handle : null
}

function whatsappUrl(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('55') ? digits : '55' + digits
  return 'https://wa.me/' + normalized
}

export function ResumePage() {
  const { slug = '' } = useParams()
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    siteContentApi.resume(slug)
      .then(row => { if (active) setResume(row) })
      .catch(() => { if (active) setResume(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!resume) return
    const previous = document.title
    document.title = resume.seo_title || [resume.display_name, resume.headline].filter(Boolean).join(' — ') || 'Currículo'
    return () => { document.title = previous }
  }, [resume])

  const contacts = useMemo(() => {
    if (!resume) return []
    const whatsapp = whatsappUrl(resume.whatsapp || resume.contact_phone)
    const emailHref = resume.contact_email
      ? 'mailto:' + resume.contact_email + '?subject=' + encodeURIComponent('Contato profissional via currículo')
      : null
    return [
      resume.contact_email ? { label:'E-mail', value:resume.contact_email, href:emailHref, action:'Escrever e-mail' } : null,
      whatsapp ? { label:'WhatsApp', value:resume.whatsapp || resume.contact_phone || 'Conversar', href:whatsapp, action:'Conversar no WhatsApp' } : null,
      resume.contact_phone ? { label:'Telefone', value:resume.contact_phone, href:'tel:' + resume.contact_phone.replace(/[^\d+]/g,''), action:'Ligar agora' } : null,
      resume.instagram ? { label:'Instagram', value:resume.instagram, href:instagramUrl(resume.instagram), action:'Abrir Instagram' } : null,
      resume.linkedin_url ? { label:'LinkedIn', value:'Perfil profissional', href:externalUrl(resume.linkedin_url), action:'Abrir LinkedIn' } : null,
      resume.website_url ? { label:'Site', value:resume.website_url.replace(/^https?:\/\//,''), href:externalUrl(resume.website_url), action:'Abrir site' } : null,
    ].filter(Boolean) as Array<{label:string;value:string;href:string|null;action:string}>
  }, [resume])

  if (loading) {
    return <div className="min-h-screen bg-[#f3f0e8] flex items-center justify-center text-[#1a1a1a]"><div className="w-9 h-9 rounded-full border-2 border-[#171717] border-t-transparent animate-spin" /></div>
  }

  if (!resume) {
    return <div className="min-h-screen bg-[#f3f0e8] text-[#171717] flex items-center justify-center px-6"><div className="max-w-md text-center"><p className="text-xs uppercase tracking-[.3em] text-black/45">Currículo</p><h1 className="text-4xl font-black mt-4">Página indisponível</h1><p className="text-sm text-black/55 mt-4">Este currículo não está publicado ou o endereço não existe.</p><Link to="/" className="inline-flex mt-7 px-5 py-3 rounded-full bg-[#171717] text-white text-sm font-semibold">Voltar ao site</Link></div></div>
  }

  const hasSkills = Array.isArray(resume.skills) && resume.skills.length > 0
  const hasIdentity = Boolean(resume.identity_text?.trim())
  const hasMeta = Boolean(resume.location || resume.market_since)
  const initials = (resume.display_name || 'CV').split(/\s+/).filter(Boolean).slice(0, 2).map(item => item.charAt(0)).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#171717] selection:bg-[#171717] selection:text-white">
      <header className="border-b border-black/10">
        <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="text-[11px] uppercase tracking-[.24em] font-bold">Felipe Costa</Link>
          <span className="text-[10px] uppercase tracking-[.2em] text-black/45">{resume.resume_type === 'mini' ? 'Minicurrículo' : 'Perfil profissional'}</span>
        </div>
      </header>

      <main>
        <section className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-10 md:py-16 lg:py-20">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)] gap-10 lg:gap-16 items-end">
            <div>
              {resume.eyebrow && <p className="text-[11px] md:text-xs uppercase tracking-[.28em] font-bold text-[#b80f1c]">{resume.eyebrow}</p>}
              {resume.display_name && <h1 className="mt-5 text-[clamp(3.3rem,8vw,8.5rem)] leading-[.84] tracking-[-.065em] font-black max-w-5xl">{resume.display_name}</h1>}
              {resume.headline && <p className="mt-7 md:mt-9 text-xl md:text-3xl leading-tight max-w-3xl font-medium">{resume.headline}</p>}
              {resume.callout && <p className="mt-7 max-w-2xl border-l-2 border-[#b80f1c] pl-5 text-base md:text-lg italic text-black/70">{resume.callout}</p>}
            </div>

            <div className="relative">
              <div className="absolute -inset-3 md:-inset-5 border border-black/10 rounded-[2rem] rotate-2" aria-hidden="true" />
              <div className="relative aspect-[4/5] rounded-[1.6rem] overflow-hidden bg-[#171717]">
                {resume.photo_url ? <img src={resume.photo_url} alt={resume.display_name || 'Foto profissional'} className="w-full h-full object-cover grayscale-[10%]" /> : <div className="w-full h-full flex items-center justify-center text-[7rem] font-black text-white/15">{initials}</div>}
                {hasMeta && <div className="absolute left-4 right-4 bottom-4 flex flex-wrap gap-2">
                  {resume.location && <span className="px-3 py-2 rounded-full bg-white/90 backdrop-blur text-[11px] font-semibold">{resume.location}</span>}
                  {resume.market_since && <span className="px-3 py-2 rounded-full bg-[#171717]/90 text-white text-[11px] font-semibold">Design desde {resume.market_since}</span>}
                </div>}
              </div>
            </div>
          </div>
        </section>

        {resume.summary && (
          <section className="border-y border-black/10 bg-white/35">
            <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20 grid md:grid-cols-[220px_1fr] gap-7 md:gap-14">
              <p className="text-[11px] uppercase tracking-[.24em] font-bold text-black/45">Sobre mim</p>
              <p className="text-2xl md:text-4xl lg:text-[2.8rem] leading-[1.16] tracking-[-.03em] max-w-5xl">{resume.summary}</p>
            </div>
          </section>
        )}

        {hasIdentity && (
          <section className="bg-[#171717] text-[#f3f0e8]">
            <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-24 grid md:grid-cols-[220px_1fr] gap-7 md:gap-14">
              <div>
                <p className="text-[11px] uppercase tracking-[.24em] font-bold text-white/45">Identidade & território</p>
                <div className="mt-5 w-10 h-1 bg-[#E30613]" />
              </div>
              <p className="text-xl md:text-3xl leading-relaxed max-w-5xl text-white/90">{resume.identity_text}</p>
            </div>
          </section>
        )}

        {hasSkills && (
          <section className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-20">
            <div className="grid md:grid-cols-[220px_1fr] gap-7 md:gap-14">
              <p className="text-[11px] uppercase tracking-[.24em] font-bold text-black/45">Atuação</p>
              <div className="flex flex-wrap gap-2.5">
                {resume.skills.map(skill => <span key={skill} className="px-4 py-2.5 rounded-full border border-black/15 bg-white/40 text-sm md:text-base font-medium">{skill}</span>)}
              </div>
            </div>
          </section>
        )}

        {contacts.length > 0 && (
          <section className="border-t border-black/10">
            <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-20">
              <p className="text-[11px] uppercase tracking-[.24em] font-bold text-[#b80f1c]">Contato</p>
              <div className="mt-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-9">
                <div>
                  <h2 className="text-4xl md:text-6xl font-black tracking-[-.045em]">Vamos conversar.</h2>
                  <p className="text-sm text-black/50 mt-3">Contatos desta versão do currículo.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 min-w-0 w-full lg:max-w-2xl">
                  {contacts.map(item => item.href ? (
                    <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined} className="group min-w-0 rounded-2xl border border-black/10 bg-white/45 px-4 py-4 hover:bg-white/80 hover:border-black/20 transition-all">
                      <span className="block text-[10px] uppercase tracking-[.18em] text-black/40">{item.label}</span>
                      <span className="block mt-1 text-sm md:text-base font-semibold break-all">{item.value}</span>
                      <span className="inline-flex mt-3 text-xs font-bold text-[#b80f1c] group-hover:translate-x-0.5 transition-transform">{item.action} →</span>
                    </a>
                  ) : null)}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-black/10">
        <div className="max-w-[1380px] mx-auto px-5 sm:px-8 lg:px-12 py-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-[10px] uppercase tracking-[.16em] text-black/40">
          <span>{resume.display_name || 'Currículo profissional'}</span>
          <span>Perfil publicado pela Play Moments</span>
        </div>
      </footer>
    </div>
  )
}
