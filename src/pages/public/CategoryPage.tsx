import { useParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { ServicesPage } from './ServicesPage'

const CATEGORIES: Record<string, { title: string; subtitle: string; icon: string; color: string }> = {
  studio: { title: 'Studio & Criação', subtitle: 'Produção audiovisual, fotografia e motion design de alto nível', icon: '🎬', color: '#ff6b35' },
  design: { title: 'Design & Digital', subtitle: 'Identidade visual, UI/UX, sites e presença digital estratégica', icon: '✦', color: '#4cc9f0' },
  tech: { title: 'Tech & Equipamentos', subtitle: 'Locação e setup de equipamentos profissionais', icon: '⚡', color: '#06d6a0' },
}

export function CategoryPage() {
  const { category } = useParams<{ category: string }>()
  const cat = CATEGORIES[category ?? '']

  if (!cat) return <ServicesPage />

  return (
    <PublicLayout>
      <div style={{ background: '#0a0a0b' }}>
        {/* Hero */}
        <section className="px-6 py-20 text-center">
          <span className="text-5xl block mb-4">{cat.icon}</span>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: cat.color }}>Área de atuação</p>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#f0f0f2' }}>{cat.title}</h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#6b6b78' }}>{cat.subtitle}</p>
        </section>

        <div className="px-6 pb-20">
          <ServicesPage />
        </div>
      </div>
    </PublicLayout>
  )
}
