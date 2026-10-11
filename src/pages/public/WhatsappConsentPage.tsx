import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandImage } from '../../components/BrandImage'
import { useAuth } from '../../contexts/AuthContext'
import { settingsApi, type UserPreferences } from '../../api/settings'
import { supabase } from '../../lib/supabase'
import { authLink } from '../../lib/navigation'
import { WHATSAPP_CONSENT_PATH, saveWhatsappConsent, whatsappConsentCurrent, whatsappPhone } from '../../lib/whatsappConsent'

export function WhatsappConsentPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [account, setAccount] = useState<{ id: string; phone: string | null; preferences: UserPreferences | null } | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [retry, setRetry] = useState(0)
  const busy = useRef(false)
  const customer = isAuthenticated && user?.role === 'customer'
  const current = account?.id === user?.id ? account : null
  const phone = whatsappPhone(current?.phone)
  const authorized = whatsappConsentCurrent(current?.preferences || null, phone)

  useEffect(() => {
    setAccount(null); setError(''); setCancelled(false)
    if (!customer || !user) return
    let active = true
    void Promise.all([
      settingsApi.userPreferences(),
      supabase.from('profiles').select('phone').eq('id', user.id).single(),
    ]).then(([preferences, profile]) => {
      if (!active) return
      if (profile.error) throw profile.error
      setAccount({ id: user.id, phone: profile.data.phone, preferences })
    }).catch(() => { if (active) setError('Não foi possível carregar sua autorização. Tente novamente.') })
    return () => { active = false }
  }, [customer, user?.id, retry])

  async function consent(enabled: boolean) {
    if (busy.current || !current || !user || !customer) return
    busy.current = true; setSaving(true); setError('')
    try {
      // Consent must apply to the number the person actually saw on this page.
      const profile = await supabase.from('profiles').select('phone').eq('id', user.id).single()
      if (profile.error) throw profile.error
      if (enabled && whatsappPhone(profile.data.phone) !== phone) {
        setAccount({ ...current, phone: profile.data.phone })
        throw new Error('Seu telefone foi alterado. Confira o número abaixo e aceite novamente.')
      }
      const preferences = await settingsApi.userPreferences()
      if (preferences && preferences.user_id !== current.id) throw new Error('A conta conectada mudou. Recarregue a página antes de autorizar.')
      const saved = await saveWhatsappConsent(preferences, phone, enabled, values => settingsApi.saveUserPreferences(values, current.id))
      setAccount({ ...current, preferences: saved }); setCancelled(!enabled)
      window.dispatchEvent(new CustomEvent('playmoments:preferences', { detail: saved }))
    } catch (err: any) { setError(err.message || 'Não foi possível salvar. Tente novamente.') }
    finally { busy.current = false; setSaving(false) }
  }

  return <main className="min-h-screen flex items-center justify-center bg-[#0a0a0b] px-5 py-10 text-gray-300">
    <div className="w-full max-w-md">
      <Link to="/" className="mb-8 flex justify-center"><BrandImage variant="dark" alt="Sagamente" style={{ height: 30 }} /></Link>
      <section className="rounded-3xl border border-white/10 bg-[#141416] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#DFA269]">Avisos pelo WhatsApp</p>
        <h1 className="mt-3 text-2xl font-bold text-white">{authorized ? 'Pronto! Você autorizou os avisos.' : 'Acompanhe cada passo do seu projeto'}</h1>
        <p className="mt-3 text-sm leading-relaxed">Receba atualizações de projetos, etapas, tarefas e arquivos da Sagamente no seu WhatsApp.</p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed">
          <h2 className="font-semibold text-white">Sua autorização</h2>
          <p className="mt-2">Ao tocar em “Aceitar e ativar avisos”, autorizo a Sagamente a enviar mensagens sobre meus projetos para o WhatsApp cadastrado na minha conta. Esta autorização é para avisos dos projetos, sem mensagens promocionais. Posso cancelar os avisos a qualquer momento nesta página ou nas configurações da minha conta.</p>
        </div>
        {current && <div className="mt-5 text-sm"><p className="text-xs text-gray-400">WhatsApp cadastrado · {user?.name}</p><p className="mt-1 font-semibold text-white">{current.phone || 'Nenhum número cadastrado'}</p><Link to="/app/perfil" className="mt-2 inline-block text-xs text-[#DFA269] underline">Conferir ou alterar meu número</Link></div>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        {cancelled && <p role="status" className="mt-4 text-sm text-gray-300">Os avisos pelo WhatsApp foram desativados.</p>}
        {isLoading ? <p role="status" className="mt-5 text-sm">Carregando sua conta…</p>
          : !isAuthenticated ? <><Link to={authLink('/login', WHATSAPP_CONSENT_PATH)} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#A65A2A] px-4 text-sm font-bold text-white">Entrar para autorizar</Link><p className="mt-3 text-center text-xs text-gray-400">Entre na sua conta. Depois você volta aqui para aceitar.</p></>
          : !customer ? <p className="mt-5 text-sm">Este aceite deve ser feito pela conta do cliente que receberá os avisos.</p>
          : !current ? <>{!error ? <p role="status" className="mt-5 text-sm">Conferindo seu número…</p> : <button onClick={() => setRetry(value => value + 1)} className="mt-5 text-sm text-[#DFA269]">Tentar novamente</button>}</>
          : authorized ? <><p role="status" className="mt-4 text-sm text-emerald-300">Autorização ativa para o número acima.</p><Link to="/app/projetos" className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-[#A65A2A] text-sm font-bold text-white">Ver meus projetos</Link><button disabled={saving} onClick={() => void consent(false)} className="mt-4 min-h-10 w-full text-xs text-gray-400 disabled:opacity-50">{saving ? 'Salvando…' : 'Cancelar avisos pelo WhatsApp'}</button></>
          : <><button disabled={saving || !phone} onClick={() => void consent(true)} className="mt-6 min-h-12 w-full rounded-xl bg-[#A65A2A] px-4 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Ativando…' : 'Aceitar e ativar avisos'}</button>{!phone && <p className="mt-3 text-xs text-amber-200">Cadastre um WhatsApp com DDD no seu perfil para ativar os avisos.</p>}</>}
        {customer && current?.preferences?.wa_automatic_opt_in && !authorized && <button disabled={saving} onClick={() => void consent(false)} className="mt-4 min-h-10 w-full text-xs text-gray-400 disabled:opacity-50">Cancelar autorização anterior</button>}
      </section>
    </div>
  </main>
}
