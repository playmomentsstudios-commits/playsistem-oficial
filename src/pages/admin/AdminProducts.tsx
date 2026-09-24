import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

const DEMO = [
  { id: '1', name: 'Câmera Sony FX6', sku: 'FX6-001', price: 85000000, stock: 3, status: 'published', type: 'equipment', featured: true },
  { id: '2', name: 'Kit Iluminação LED', sku: 'LED-KIT-001', price: 24900000, stock: 5, status: 'published', type: 'equipment', featured: true },
  { id: '3', name: 'Microfone Rode NTG5', sku: 'RODE-NTG5', price: 18900000, stock: 8, status: 'published', type: 'equipment', featured: false },
  { id: '4', name: 'Drone DJI Mavic 3 Pro', sku: 'DJI-M3P', price: 129000000, stock: 0, status: 'published', type: 'equipment', featured: true },
]

function fmt(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function AdminProducts() {
  const [search, setSearch] = useState('')
  const filtered = DEMO.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Produtos</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>{DEMO.length} produtos cadastrados</p>
        </div>
        <Button>+ Novo produto</Button>
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
          className="w-full max-w-sm px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{ color: '#6b6b78', borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 100px 80px' }}>
            <span>Produto</span><span>SKU</span><span>Preço</span><span>Estoque</span><span>Status</span><span>Ações</span>
          </div>
        </div>
        {filtered.map((p, i) => (
          <div key={p.id} className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02]"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 100px 80px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{p.name}</p>
              {p.featured && <Badge variant="brand">Destaque</Badge>}
            </div>
            <span className="text-sm font-mono" style={{ color: '#9090a0' }}>{p.sku}</span>
            <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{fmt(p.price)}</span>
            <span className="text-sm" style={{ color: p.stock === 0 ? '#ff6b7a' : '#f0f0f2' }}>{p.stock}</span>
            <Badge variant={p.status === 'published' ? 'success' : 'default'}>
              {p.status === 'published' ? 'Publicado' : 'Rascunho'}
            </Badge>
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090a0' }}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
