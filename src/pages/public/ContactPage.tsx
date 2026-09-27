import { useEffect, useState } from 'react'
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
          Escolha o canal que preferir. Os dados abaixo são gerenciados nas configurações do site.
        </p>

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
