import { PublicLayout } from '../../layouts/PublicLayout'
import type { PortfolioProject } from '../../types'

const PROJECTS: PortfolioProject[] = [
  { id: '1', title: 'Vertice — Identidade Visual', slug: 'vertice-identidade', client: 'Vertice Consultoria', categoryId: 'design', description: 'Identidade visual completa da marca.', shortDescription: 'Marca corporativa premium', cover: 'https://images.unsplash.com/photo-1634942537034-2531766767d1?w=700&h=450&fit=crop&auto=format', date: '2024-01', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '2', title: 'Evento Tech Summit 2024', slug: 'tech-summit-2024', client: 'Tech Summit', categoryId: 'studio', description: 'Cobertura audiovisual completa.', shortDescription: 'Produção audiovisual de evento', cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&h=450&fit=crop&auto=format', date: '2024-03', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '3', title: 'Campanha Digital Pulsar', slug: 'campanha-pulsar', client: 'Pulsar Energia', categoryId: 'design', description: 'Campanha digital multicanal.', shortDescription: 'Campanha digital e redes sociais', cover: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=700&h=450&fit=crop&auto=format', date: '2024-05', featured: false, active: true, createdAt: '', updatedAt: '' },
  { id: '4', title: 'Setup Studio Momentum', slug: 'setup-studio-momentum', client: 'Momentum Creative', categoryId: 'tech', description: 'Instalação completa de estúdio profissional.', shortDescription: 'Setup completo de estúdio', cover: 'https://images.unsplash.com/photo-1607827448387-a67db879ce5f?w=700&h=450&fit=crop&auto=format', date: '2024-06', featured: false, active: true, createdAt: '', updatedAt: '' },
  { id: '5', title: 'Vídeo Institucional NovaBR', slug: 'video-novabr', client: 'NovaBR', categoryId: 'studio', description: 'Produção de vídeo corporativo para apresentação internacional.', shortDescription: 'Vídeo corporativo internacional', cover: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=700&h=450&fit=crop&auto=format', date: '2024-08', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '6', title: 'Site E-commerce ProFit', slug: 'site-profit', client: 'ProFit Nutrition', categoryId: 'design', description: 'Desenvolvimento de e-commerce completo.', shortDescription: 'E-commerce com alta conversão', cover: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=700&h=450&fit=crop&auto=format', date: '2024-09', featured: false, active: true, createdAt: '', updatedAt: '' },
]

const CAT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'design', label: 'Design & Digital' },
  { id: 'studio', label: 'Studio & Criação' },
  { id: 'tech', label: 'Tech & Equipamentos' },
]

import { useState } from 'react'

export function PortfolioPage() {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? PROJECTS : PROJECTS.filter(p => p.categoryId === filter)

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 1100 }}>
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613' }}>Nosso trabalho</p>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#f0f0f2' }}>Portfólio</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Projetos que transformaram marcas</p>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CAT_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                background: filter === f.id ? '#E30613' : 'rgba(255,255,255,0.06)',
                color: filter === f.id ? '#fff' : '#9090a0',
                border: `1px solid ${filter === f.id ? '#E30613' : 'rgba(255,255,255,0.1)'}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(project => (
            <div key={project.id}
              className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1"
              style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="overflow-hidden" style={{ height: 240 }}>
                <img src={project.cover} alt={project.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'rgba(10,10,11,0.7)' }}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold text-white mb-1">Ver projeto</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs mb-1" style={{ color: '#E30613' }}>{project.client}</p>
                <p className="font-semibold" style={{ color: '#f0f0f2' }}>{project.title}</p>
                <p className="text-xs mt-1" style={{ color: '#6b6b78' }}>{project.shortDescription}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
