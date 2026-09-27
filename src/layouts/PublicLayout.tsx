import { useEffect,useState,type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicHeader } from '../components/navigation/PublicHeader'
import logoUrl from '../assets/logo-play-moments.png'
import { siteContentApi,type SiteSettings } from '../services/siteContent'

export function PublicLayout({ children }: { children: ReactNode }) {
  const [settings,setSettings]=useState<SiteSettings|null>(null)
  const [serviceAreas,setServiceAreas]=useState<Array<{id:string;title:string;href:string}>>([])

  useEffect(()=>{
    let active=true
    Promise.all([siteContentApi.settings(),siteContentApi.homeServiceAreas()]).then(([data,areas])=>{if(active){setSettings(data);setServiceAreas(areas)}}).catch(()=>undefined)
    return()=>{active=false}
  },[])

  const primary=settings?.primary_color||'#E30613'
  const socials=[
    ['Instagram',settings?.instagram_url],
    ['YouTube',settings?.youtube_url],
    ['TikTok',settings?.tiktok_url],
    ['LinkedIn',settings?.linkedin_url],
  ].filter((item):item is [string,string]=>Boolean(item[1]))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0b' }}>
      <PublicHeader settings={settings}/>
      <main className="flex-1">{children}</main>
      <footer style={{ background: '#0d0d0f', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto px-6 py-12" style={{ maxWidth: 1200 }}>
          <div className="grid gap-8 md:grid-cols-4 mb-10">
            <div>
              <img src={logoUrl} alt={settings?.company_name||'Play Moments'} style={{ height: 28, width: 'auto', marginBottom: 16 }} />
              <p className="text-sm leading-relaxed" style={{ color: '#6b6b78' }}>
                {settings?.footer_description||settings?.description||'Plataforma criativa para tecnologia, estúdio e design digital.'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: primary }}>Serviços</p>
              {serviceAreas.map(area => (
                <Link key={area.id} to={area.href} className="block text-sm mb-2 transition-colors" style={{ color: '#6b6b78' }}>{area.title}</Link>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: primary }}>Plataforma</p>
              {[['Portfólio', '/portfolio'], ['Comunidade', '/comunidade'], ['Minha Conta', '/app/dashboard']].map(([label, href]) => (
                <Link key={href} to={href} className="block text-sm mb-2 transition-colors" style={{ color: '#6b6b78' }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: primary }}>Contato</p>
              {settings?.contact_email&&<a href={'mailto:'+settings.contact_email} className="block text-sm mb-2" style={{color:'#6b6b78'}}>{settings.contact_email}</a>}
              {settings?.contact_phone&&<a href={'tel:'+settings.contact_phone.replace(/[^+\d]/g,'')} className="block text-sm mb-2" style={{color:'#6b6b78'}}>{settings.contact_phone}</a>}
              {settings?.whatsapp&&<a href={'https://wa.me/'+settings.whatsapp.replace(/\D/g,'')} target="_blank" rel="noreferrer" className="block text-sm mb-2" style={{color:'#6b6b78'}}>WhatsApp</a>}
              {settings?.address&&<p className="text-sm mb-1" style={{ color: '#6b6b78' }}>{settings.address}</p>}
              {(settings?.city||settings?.state)&&<p className="text-sm" style={{ color: '#6b6b78' }}>{[settings?.city,settings?.state].filter(Boolean).join(' · ')}</p>}
              {!settings&&<><p className="text-sm mb-2" style={{ color: '#6b6b78' }}>contato@playmoments.com.br</p><p className="text-sm" style={{ color: '#6b6b78' }}>São Paulo, SP</p></>}
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs" style={{ color: '#3a3a42' }}>© {new Date().getFullYear()} {settings?.company_name||'Play Moments'} · Todos os direitos reservados</p>
            {socials.length>0&&<div className="flex flex-wrap justify-center gap-4 mt-4 md:mt-0">
              {socials.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer" className="text-xs" style={{color:'#6b6b78'}}>{label}</a>)}
            </div>}
          </div>
        </div>
      </footer>
    </div>
  )
}
