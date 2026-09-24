import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import type { Service } from '../../types'

const DEMO_SERVICES: Service[] = [
  { id: '1', name: 'Produção de Vídeo Corporativo', slug: 'producao-video-corporativo', categoryId: 'studio', description: 'Produção completa de vídeos institucionais, treinamentos e cases de sucesso com equipe especializada.', shortDescription: 'Vídeos corporativos de alto nível', priceType: 'starting_at', startingPrice: 250000, images: ['https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: '10 a 20 dias úteis', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '2', name: 'Identidade Visual Completa', slug: 'identidade-visual-completa', categoryId: 'design', description: 'Criação de identidade visual completa: logotipo, paleta de cores, tipografia, papelaria e guia de marca.', shortDescription: 'Marca completa do zero', priceType: 'starting_at', startingPrice: 350000, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: '15 a 25 dias úteis', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '3', name: 'Criação de Site Premium', slug: 'criacao-site-premium', categoryId: 'design', description: 'Desenvolvimento de sites modernos, responsivos e otimizados para SEO com gestão de conteúdo integrada.', shortDescription: 'Site moderno e otimizado', priceType: 'starting_at', startingPrice: 450000, images: ['https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: '20 a 40 dias úteis', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '4', name: 'Aluguel de Câmera e Equipamentos', slug: 'aluguel-camera-equipamentos', categoryId: 'tech', description: 'Locação diária de câmeras profissionais, lentes, tripés, iluminação e acessórios para produções.', shortDescription: 'Locação de equipamentos profissionais', priceType: 'starting_at', startingPrice: 50000, images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: 'Por diária', featured: false, active: true, createdAt: '', updatedAt: '' },
  { id: '5', name: 'Fotografia Profissional', slug: 'fotografia-profissional', categoryId: 'studio', description: 'Ensaios fotográficos para produtos, eventos corporativos, e-commerce e retratos profissionais.', shortDescription: 'Fotografias de alta qualidade', priceType: 'starting_at', startingPrice: 180000, images: ['https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: '3 a 7 dias úteis', featured: true, active: true, createdAt: '', updatedAt: '' },
  { id: '6', name: 'Motion Design & Animação', slug: 'motion-design-animacao', categoryId: 'studio', description: 'Criação de animações 2D/3D, vinhetas, intros, motion graphics para redes sociais e vídeos.', shortDescription: 'Animações e motion graphics', priceType: 'quote', images: ['https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600&h=400&fit=crop&auto=format'], estimatedDelivery: 'Conforme escopo', featured: false, active: true, createdAt: '', updatedAt: '' },
]

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const CATEGORY_LABEL: Record<string, string> = {
  studio: 'Studio & Criação',
  design: 'Design & Digital',
  tech: 'Tech & Equipamentos',
}
const CATEGORY_COLOR: Record<string, string> = {
  studio: '#ff6b35',
  design: '#4cc9f0',
  tech: '#06d6a0',
}

export function ServicesPage() {
  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 1100 }}>
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613' }}>O que fazemos</p>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#f0f0f2' }}>Nossos Serviços</h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: '#6b6b78', lineHeight: 1.7 }}>
            Da estratégia à execução — serviços completos para marcas que querem se destacar.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_SERVICES.map(service => {
            const catColor = CATEGORY_COLOR[service.categoryId ?? ''] ?? '#E30613'
            const catLabel = CATEGORY_LABEL[service.categoryId ?? ''] ?? 'Serviço'
            return (
              <Link key={service.id} to={`/servicos/${service.slug}`}
                className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
                {service.images[0] && (
                  <div className="overflow-hidden" style={{ height: 180 }}>
                    <img src={service.images[0]} alt={service.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-xs font-semibold mb-2" style={{ color: catColor }}>{catLabel}</span>
                  <h3 className="font-bold text-base mb-2" style={{ color: '#f0f0f2' }}>{service.name}</h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: '#9090a0' }}>{service.shortDescription}</p>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      {service.priceType === 'quote' ? (
                        <span className="text-sm font-semibold" style={{ color: '#9090a0' }}>Consultar preço</span>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                          {service.priceType === 'starting_at' ? 'A partir de ' : ''}{formatPrice(service.startingPrice ?? service.price ?? 0)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#E30613' }}>Ver mais →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </PublicLayout>
  )
}
