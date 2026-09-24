import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'

const TABS = ['Geral', 'Aparência', 'Redes Sociais', 'Contato', 'SEO']

export function AdminSiteSettings() {
  const [tab, setTab] = useState('Geral')
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const [settings, setSettings] = useState({
    companyName: 'Play Moments',
    description: 'Studio de criação, design digital e tecnologia em equipamentos.',
    heroHeadline: 'Criamos momentos que ficam.',
    heroCta: 'Explorar serviços',
    primaryColor: '#E30613',
    instagram: 'https://instagram.com/playmoments',
    youtube: '',
    tiktok: '',
    linkedin: '',
    whatsapp: '',
    email: 'contato@playmoments.com.br',
    phone: '',
    address: '',
    metaDescription: 'Play Moments — Studio criativo de vídeo, design e tecnologia.',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    toast('Configurações salvas!', 'success')
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Configurações do Site</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Personalize o conteúdo e a aparência do site público</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t ? '#E30613' : 'transparent',
              color: tab === t ? '#fff' : '#9090a0',
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === 'Geral' && (
          <div className="flex flex-col gap-4">
            <Input label="Nome da empresa" value={settings.companyName} onChange={set('companyName')} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9090a0' }}>Descrição</label>
              <textarea value={settings.description} onChange={set('description')} rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
            </div>
            <Input label="Headline principal (Hero)" value={settings.heroHeadline} onChange={set('heroHeadline')} />
            <Input label="Texto do botão CTA" value={settings.heroCta} onChange={set('heroCta')} />
          </div>
        )}

        {tab === 'Aparência' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9090a0' }}>Cor principal da marca</label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.primaryColor} onChange={set('primaryColor')}
                  className="w-12 h-10 rounded-lg cursor-pointer border-0" />
                <span className="text-sm font-mono" style={{ color: '#f0f0f2' }}>{settings.primaryColor}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(76,201,240,0.08)', border: '1px solid rgba(76,201,240,0.2)', color: '#67d7f0' }}>
              <p className="text-xs">Para alterar logo e favicon, use o painel de assets. Upload de imagens disponível após integração completa com storage.</p>
            </div>
          </div>
        )}

        {tab === 'Redes Sociais' && (
          <div className="flex flex-col gap-4">
            <Input label="Instagram" placeholder="https://instagram.com/..." value={settings.instagram} onChange={set('instagram')} />
            <Input label="YouTube" placeholder="https://youtube.com/..." value={settings.youtube} onChange={set('youtube')} />
            <Input label="TikTok" placeholder="https://tiktok.com/..." value={settings.tiktok} onChange={set('tiktok')} />
            <Input label="LinkedIn" placeholder="https://linkedin.com/..." value={settings.linkedin} onChange={set('linkedin')} />
            <Input label="WhatsApp (número com DDI)" placeholder="+5511999999999" value={settings.whatsapp} onChange={set('whatsapp')} />
          </div>
        )}

        {tab === 'Contato' && (
          <div className="flex flex-col gap-4">
            <Input label="E-mail de contato" type="email" value={settings.email} onChange={set('email')} />
            <Input label="Telefone" value={settings.phone} onChange={set('phone')} />
            <Input label="Endereço" value={settings.address} onChange={set('address')} />
          </div>
        )}

        {tab === 'SEO' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9090a0' }}>Meta Description</label>
              <textarea value={settings.metaDescription} onChange={set('metaDescription')} rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
              <p className="text-xs" style={{ color: '#6b6b78' }}>{settings.metaDescription.length}/160 caracteres</p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button onClick={save} loading={loading}>Salvar configurações</Button>
        </div>
      </div>
    </div>
  )
}
