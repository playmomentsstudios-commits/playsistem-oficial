import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface PwaPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
export function InstallPage() {
  const [promptEvent, setPromptEvent] = useState<PwaPrompt | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent)
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setPromptEvent(event as PwaPrompt) }
    const done = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('beforeinstallprompt', ready)
      window.removeEventListener('appinstalled', done)
    }
  }, [])
  async function install() {
    if (!promptEvent) return
    const event = promptEvent
    setPromptEvent(null)
    try {
      await event.prompt()
      const decision = await event.userChoice
      if (decision.outcome === 'accepted') setInstalled(true)
    } catch { /* Manual instructions remain available. */ }
  }
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-[#F3EDE7] px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-[#DFA269] text-sm hover:underline">← Voltar ao Sagamente</Link>
        <div className="flex items-center gap-5 mt-10 mb-6">
          <img src="/pwa/icon-192.png" width="80" height="80" alt="Símbolo Sagamente" className="rounded-2xl" />
          <div><p className="text-xs uppercase tracking-widest text-[#DFA269]">Aplicativo gratuito</p><h1 className="text-3xl sm:text-4xl font-bold mt-1">Instale o Sagamente</h1></div>
        </div>
        <p className="text-[#b8b8c0] leading-relaxed max-w-2xl mb-8">Tenha o Sagamente no celular ou computador, com ícone próprio, acesso rápido e os mesmos dados, projetos, serviços e cursos do site.</p>
        {installed ? (
          <p role="status" className="mb-8 p-4 rounded-xl bg-[#2E5D46]/20 border border-[#2E5D46]">Você já está usando o Sagamente no modo aplicativo.</p>
        ) : promptEvent ? (
          <button type="button" onClick={() => { void install() }} className="mb-8 min-h-12 px-6 rounded-xl bg-[#A65A2A] hover:bg-[#81431E] font-bold text-white">Instalar Sagamente gratuitamente</button>
        ) : (
          <p role="status" className="text-sm text-[#DFA269] mb-8">{ios ? 'No iPhone, use Compartilhar e Adicionar à Tela de Início.' : 'Use o menu do seu navegador para instalar seguindo as instruções.'}</p>
        )}
        <h2 className="text-xl font-bold mb-5">Como instalar</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <section className="border border-white/10 rounded-2xl p-5 bg-white/[.035]"><h3 className="font-bold mb-2">Android</h3><p className="text-sm text-[#a6a6b0] leading-relaxed">No Chrome, abra ⋮ e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</p></section>
          <section className="border border-white/10 rounded-2xl p-5 bg-white/[.035]"><h3 className="font-bold mb-2">iPhone</h3><p className="text-sm text-[#a6a6b0] leading-relaxed">Abra o menu Compartilhar e selecione “Adicionar à Tela de Início”.</p></section>
          <section className="border border-white/10 rounded-2xl p-5 bg-white/[.035]"><h3 className="font-bold mb-2">Windows</h3><p className="text-sm text-[#a6a6b0] leading-relaxed">No Chrome ou Edge, use o ícone de instalação da barra de endereço ou o menu.</p></section>
        </div>
        <p className="mt-7 text-sm text-[#8a8a94]">O site precisa estar em HTTPS. Projetos, arquivos privados e pagamentos exigem conexão; não ficam salvos offline.</p>
        <Link to="/login" className="inline-flex mt-7 rounded-xl border border-[#A65A2A]/60 px-5 py-3 text-[#DFA269] font-semibold">Entrar na minha conta →</Link>
      </div>
    </main>
  )
}
