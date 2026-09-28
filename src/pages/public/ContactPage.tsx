import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { siteContentApi, type SiteSettings } from '../../services/siteContent'

export function ContactPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    siteContentApi.settings().then(setSettings).finally(() => setLoading(false))
  }, [])

  const primary = settings?.primary_color || '#E30613'
  const whatsapp = settings?.whatsapp?.replace(/\D/g, '')

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-14" style={{ maxWidth: 900 }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: primary }}>Contato</p>
        <h1 className="text-4xl font-bold">Vamos conversar sobre seu projeto?</h1>
        <p className="mt-4 text-gray-400 max-w-2xl">
          Fale com a Play Moments pelo canal que preferir. Para usar o chat da plataforma, basta entrar ou criar sua conta gratuita.
        </p>
        <div className="mt-8 p-5 md:p-6 rounded-2xl border border-[#E30613]/25 bg-[#E30613]/[.055] flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#E30613] text-white flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></svg>
          </div>
          <div className="flex-1"><p className="font-semibold">Chat Play Moments</p><p className="text-sm text-gray-400 mt-1">Tire dúvidas, conheça nossos serviços ou converse com a equipe. Você não precisa já ser cliente.</p></div>
          <Link to="/login?next=%2Fapp%2Fconversas" className="min-h-11 px-5 rounded-xl bg-[#E30613] text-white text-sm font-semibold flex items-center justify-center">Iniciar conversa</Link>
        </div>

        {loading ? (
          <p className="mt-10 text-gray-400">Carregando...</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mt-10">
            {whatsapp && (
              <a href={'https://wa.me/' + whatsapp} target="_blank" rel="noreferrer"
                className="p-5 rounded-2xl bg-[#141416] border border-white/10">
                <p className="text-xs text-gray-500">WhatsApp</p>
                <p className="font-semibold mt-1">Iniciar conversa</p>
              </a>
            )}
            {settings?.contact_email && (
              <a href={'mailto:' + settings.contact_email}
                className="p-5 rounded-2xl bg-[#141416] border border-white/10">
                <p className="text-xs text-gray-500">E-mail</p>
                <p className="font-semibold mt-1 break-all">{settings.contact_email}</p>
              </a>
            )}
            {settings?.contact_phone && (
              <a href={'tel:' + settings.contact_phone.replace(/[^+\d]/g, '')}
                className="p-5 rounded-2xl bg-[#141416] border border-white/10">
                <p className="text-xs text-gray-500">Telefone</p>
                <p className="font-semibold mt-1">{settings.contact_phone}</p>
              </a>
            )}
            {settings?.address && (
              <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
                <p className="text-xs text-gray-500">Localização</p>
                <p className="font-semibold mt-1">{settings.address}</p>
              </div>
            )}
          </div>
        )}

        {!loading && !settings?.contact_email && !settings?.contact_phone && !whatsapp && !settings?.address && (
          <div className="mt-10 p-5 rounded-2xl border border-white/10 text-gray-400">
            Configure os canais de contato no painel administrativo em Site.
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
