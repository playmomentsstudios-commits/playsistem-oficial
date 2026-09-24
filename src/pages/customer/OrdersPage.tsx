import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'

const DEMO_ORDERS = [
  { id: 'o1', orderNumber: 'PM-000001', description: 'Identidade Visual Completa', total: 350000, status: 'in_production', createdAt: '2024-09-15', updatedAt: '2024-09-20' },
  { id: 'o2', orderNumber: 'PM-000002', description: 'Fotografia Profissional — Produto', total: 180000, status: 'completed', createdAt: '2024-09-01', updatedAt: '2024-09-15' },
  { id: 'o3', orderNumber: 'PM-000003', description: 'Aluguel Kit Câmera Sony FX6 (3 dias)', total: 255000, status: 'awaiting_payment', createdAt: '2024-09-22', updatedAt: '2024-09-22' },
]

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function OrdersPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Meus Pedidos</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Acompanhe seus pedidos em tempo real</p>
      </div>

      {DEMO_ORDERS.length === 0 ? (
        <EmptyState icon="📦" title="Nenhum pedido ainda" description="Seus pedidos aparecerão aqui após a contratação." />
      ) : (
        <div className="flex flex-col gap-3">
          {DEMO_ORDERS.map(order => (
            <Link key={order.id} to={`/app/pedidos/${order.id}`}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl transition-all hover:-translate-y-0.5"
              style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ background: 'rgba(227,6,19,0.1)', border: '1px solid rgba(227,6,19,0.2)' }}>
                  📦
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#E30613' }}>{order.orderNumber}</p>
                  <p className="text-sm" style={{ color: '#f0f0f2' }}>{order.description}</p>
                  <p className="text-xs" style={{ color: '#6b6b78' }}>
                    Criado em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} />
                <span className="font-bold" style={{ color: '#f0f0f2' }}>{formatPrice(order.total)}</span>
                <span className="text-sm" style={{ color: '#E30613' }}>Ver →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
