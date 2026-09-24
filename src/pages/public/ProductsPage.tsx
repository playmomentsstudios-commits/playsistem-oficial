import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { Badge } from '../../components/ui/Badge'
import type { Product } from '../../types'

const DEMO_PRODUCTS: Product[] = [
  { id: '1', name: 'Câmera Sony FX6', slug: 'camera-sony-fx6', sku: 'FX6-001', description: 'Câmera cinematográfica profissional Full-Frame com dual ISO nativo e saída de vídeo 4K.', shortDescription: 'Cinema 4K Full-Frame', type: 'equipment', price: 850000, images: ['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=500&h=350&fit=crop&auto=format'], stock: 3, featured: true, active: true, status: 'published', createdAt: '', updatedAt: '' },
  { id: '2', name: 'Kit Iluminação LED Profissional', slug: 'kit-iluminacao-led', sku: 'LED-KIT-001', description: 'Kit completo com 3 painéis LED bicolor, tripés e difusores para estúdio ou locação.', shortDescription: 'Kit 3 painéis LED bicolor', type: 'equipment', price: 280000, promotionalPrice: 249000, images: ['https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=500&h=350&fit=crop&auto=format'], stock: 5, featured: true, active: true, status: 'published', createdAt: '', updatedAt: '' },
  { id: '3', name: 'Microfone Rode NTG5', slug: 'microfone-rode-ntg5', sku: 'RODE-NTG5', description: 'Microfone shotgun profissional ideal para produções externas e internas.', shortDescription: 'Shotgun profissional', type: 'equipment', price: 189000, images: ['https://images.unsplash.com/photo-1608499267993-a4f0f95aa09b?w=500&h=350&fit=crop&auto=format'], stock: 8, featured: false, active: true, status: 'published', createdAt: '', updatedAt: '' },
  { id: '4', name: 'Drone DJI Mavic 3 Pro', slug: 'drone-dji-mavic-3-pro', sku: 'DJI-M3P', description: 'Drone de cinema com sensor Hasselblad, vídeo 4K e autonomia de 43 minutos.', shortDescription: 'Drone 4K Hasselblad', type: 'equipment', price: 1290000, images: ['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=500&h=350&fit=crop&auto=format'], stock: 2, featured: true, active: true, status: 'published', createdAt: '', updatedAt: '' },
]

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const filtered = DEMO_PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 1100 }}>
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613' }}>Loja</p>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#f0f0f2' }}>Equipamentos & Produtos</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Equipamentos profissionais para locação e venda</p>
        </div>

        <div className="flex justify-center mb-8">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full max-w-md px-5 py-3 rounded-full text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map(product => (
            <Link key={product.id} to={`/produtos/${product.slug}`}
              className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="relative overflow-hidden" style={{ height: 200, background: '#1a1a1f' }}>
                {product.images[0] && (
                  <img src={product.images[0]} alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                )}
                {product.promotionalPrice && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="danger">Promoção</Badge>
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p className="text-xs mb-1" style={{ color: '#6b6b78' }}>{product.type === 'equipment' ? 'Equipamento' : 'Produto'}</p>
                <p className="font-semibold text-sm mb-2 flex-1" style={{ color: '#f0f0f2' }}>{product.name}</p>
                <div className="flex items-center gap-2">
                  {product.promotionalPrice ? (
                    <>
                      <span className="font-bold" style={{ color: '#E30613' }}>{formatPrice(product.promotionalPrice)}</span>
                      <span className="text-xs line-through" style={{ color: '#6b6b78' }}>{formatPrice(product.price)}</span>
                    </>
                  ) : (
                    <span className="font-bold" style={{ color: '#f0f0f2' }}>{formatPrice(product.price)}</span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#E30613' }}>Ver detalhes →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
