import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { OrderStatusBadge } from '../../components/ui/Badge'

const RECENT_ORDERS = [
  { id: 'o1', orderNumber: 'PM-000001', total: 350000, status: 'in_production', updatedAt: '2024-09-20' },
  { id: 'o2', orderNumber: 'PM-000002', total: 180000, status: 'completed', updatedAt: '2024-09-15' },
  { id: 'o3', orderNumber: 'PM-000003', total: 450000, status: 'awaiting_payment', updatedAt: '2024-09-22' },
]

const STATS = [
  { label: 'Pedidos ativos', value: '2', icon: '📦', href: '/app/pedidos', color: '#4cc9f0' },
  { label: 'Conversas', value: '3', icon: '💬', href: '/app/conversas', color: '#06d6a0' },
  { label: 'Orçamentos', value: '1', icon: '📋', href: '/app/orcamentos', color: '#ffd166' },
  { label: 'Arquivos', value: '8', icon: '📁', href: '/app/arquivos', color: '#ff6b35' },
]

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>
          Olá, {user?.name} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b6b78' }}>
          Aqui está um resumo do seu portal.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map(stat => (
          <Link key={stat.label} to={stat.href}
            className="flex flex-col gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs" style={{ color: '#6b6b78' }}>{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: '#f0f0f2' }}>Pedidos recentes</h2>
          <Link to="/app/pedidos" className="text-xs" style={{ color: '#E30613' }}>Ver todos →</Link>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
          {RECENT_ORDERS.map((order, i) => (
            <Link key={order.id} to={`/app/pedidos/${order.id}`}
              className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.02]"
              style={{ borderBottom: i < RECENT_ORDERS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{order.orderNumber}</p>
                <p className="text-xs" style={{ color: '#6b6b78' }}>
                  {new Date(order.updatedAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={order.status} />
                <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>
                  {formatPrice(order.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-bold mb-4" style={{ color: '#f0f0f2' }}>Ações rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Enviar mensagem', href: '/app/conversas', icon: '✉️' },
            { label: 'Ver arquivos', href: '/app/arquivos', icon: '📂' },
            { label: 'Meu perfil', href: '/app/perfil', icon: '👤' },
            { label: 'Notificações', href: '/app/notificacoes', icon: '🔔' },
          ].map(a => (
            <Link key={a.label} to={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium" style={{ color: '#9090a0' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
