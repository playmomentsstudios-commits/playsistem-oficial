import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PublicHeader } from '../components/navigation/PublicHeader'
import logoUrl from '../assets/logo-play-moments.png'

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0b' }}>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <footer style={{ background: '#0d0d0f', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto px-6 py-12" style={{ maxWidth: 1200 }}>
          <div className="grid gap-8 md:grid-cols-4 mb-10">
            <div>
              <img src={logoUrl} alt="Play Moments" style={{ height: 28, width: 'auto', marginBottom: 16 }} />
              <p className="text-sm leading-relaxed" style={{ color: '#6b6b78' }}>
                Plataforma criativa para tecnologia, estúdio e design digital.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#E30613' }}>Serviços</p>
              {['Studio & Criação', 'Design & Digital', 'Tech & Equipamentos'].map(s => (
                <p key={s} className="text-sm mb-2" style={{ color: '#6b6b78' }}>{s}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#E30613' }}>Plataforma</p>
              {[['Portfólio', '/portfolio'], ['Comunidade', '/comunidade'], ['Minha Conta', '/app/dashboard']].map(([label, href]) => (
                <Link key={href} to={href} className="block text-sm mb-2 transition-colors" style={{ color: '#6b6b78' }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: '#E30613' }}>Contato</p>
              <p className="text-sm mb-2" style={{ color: '#6b6b78' }}>contato@playmoments.com.br</p>
              <p className="text-sm" style={{ color: '#6b6b78' }}>São Paulo, SP</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs" style={{ color: '#3a3a42' }}>© 2024 Play Moments · Todos os direitos reservados</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              {['Instagram', 'YouTube', 'LinkedIn'].map(s => (
                <span key={s} className="text-xs cursor-pointer" style={{ color: '#3a3a42' }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
