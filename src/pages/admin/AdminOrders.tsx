import { useState } from 'react'
import { OrderStatusBadge } from '../../components/ui/Badge'

const DEMO_ORDERS = [
  { id: 'o1', number: 'PM-000001', customer: 'Marcos Lima', service: 'Identidade Visual', total: 350000, status: 'in_production', date: '2024-09-15' },
  { id: 'o2', number: 'PM-000002', customer: 'João Silva', service: 'Fotografia Profissional', total: 180000, status: 'completed', date: '2024-09-01' },
  { id: 'o3', number: 'PM-000003', customer: 'Ana Costa', service: 'Site Premium', total: 450000, status: 'awaiting_payment', date: '2024-09-22' },
  { id: 'o4', number: 'PM-000004', customer: 'Fernanda Rocha', service: 'Produção de Vídeo', total: 680000, status: 'processing', date: '2024-09-18' },
]

function fmt(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function AdminOrders() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? DEMO_ORDERS : DEMO_ORDERS.filter(o => o.status === filter)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Pedidos</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Gerencie todos os pedidos da plataforma</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all', 'Todos'], ['awaiting_payment', 'Aguardando'], ['in_production', 'Em produção'], ['completed', 'Concluídos']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: filter === v ? '#E30613' : 'rgba(255,255,255,0.06)',
              color: filter === v ? '#fff' : '#9090a0',
              border: `1px solid ${filter === v ? '#E30613' : 'rgba(255,255,255,0.1)'}`,
            }}>
            {l}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
        {filtered.map((o, i) => (
          <div key={o.id} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
            style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            <div>
              <p className="text-sm font-bold" style={{ color: '#E30613' }}>{o.number}</p>
              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{o.customer}</p>
              <p className="text-xs" style={{ color: '#6b6b78' }}>{o.service} · {new Date(o.date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="flex items-center gap-4">
              <OrderStatusBadge status={o.status} />
              <span className="font-bold text-sm" style={{ color: '#f0f0f2' }}>{fmt(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
