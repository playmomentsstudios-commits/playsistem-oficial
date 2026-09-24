import { Link } from 'react-router-dom'

const STATS = [
  { label: 'Clientes', value: '47', sub: '+3 esta semana', icon: '👥', href: '/admin/clientes', color: '#4cc9f0' },
  { label: 'Pedidos ativos', value: '12', sub: '4 aguardando', icon: '🛒', href: '/admin/pedidos', color: '#ffd166' },
  { label: 'Conversas abertas', value: '8', sub: '3 não lidas', icon: '💬', href: '/admin/conversas', color: '#06d6a0' },
  { label: 'Faturamento mês', value: 'R$ 28.4k', sub: '+18% vs anterior', icon: '💰', href: '/admin/pagamentos', color: '#E30613' },
  { label: 'Orçamentos', value: '5', sub: '2 aguardando resp.', icon: '📋', href: '/admin/orcamentos', color: '#ff6b35' },
  { label: 'Produtos ativos', value: '24', sub: '2 sem estoque', icon: '📦', href: '/admin/produtos', color: '#b5e48c' },
]

const RECENT_ORDERS = [
  { id: 'o1', number: 'PM-000003', customer: 'Ana Costa', service: 'Site Premium', total: 450000, status: 'awaiting_payment' },
  { id: 'o2', number: 'PM-000002', customer: 'João Silva', service: 'Fotografia', total: 180000, status: 'completed' },
  { id: 'o3', number: 'PM-000001', customer: 'Marcos Lima', service: 'Identidade Visual', total: 350000, status: 'in_production' },
]

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Aguard. pagamento',
  in_production: 'Em produção',
  completed: 'Concluído',
}
const STATUS_COLOR: Record<string, string> = {
  awaiting_payment: '#ffd166',
  in_production: '#4cc9f0',
  completed: '#06d6a0',
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Dashboard</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Visão geral da operação Play Moments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {STATS.map(stat => (
          <Link key={stat.label} to={stat.href}
            className="p-5 rounded-2xl flex flex-col gap-3 transition-all hover:-translate-y-0.5"
            style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-xs" style={{ color: '#6b6b78' }}>{stat.sub}</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs" style={{ color: '#9090a0' }}>{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: '#f0f0f2' }}>Pedidos recentes</h2>
            <Link to="/admin/pedidos" className="text-xs" style={{ color: '#E30613' }}>Ver todos →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
            {RECENT_ORDERS.map((order, i) => (
              <div key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < RECENT_ORDERS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: '#E30613' }}>{order.number}</p>
                  <p className="text-sm" style={{ color: '#f0f0f2' }}>{order.customer}</p>
                  <p className="text-xs" style={{ color: '#6b6b78' }}>{order.service}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${STATUS_COLOR[order.status]}20`, color: STATUS_COLOR[order.status] }}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  <p className="text-sm font-bold mt-1" style={{ color: '#f0f0f2' }}>{formatPrice(order.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h2 className="font-bold mb-3" style={{ color: '#f0f0f2' }}>Acesso rápido</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nova publicação', href: '/admin/comunidade', icon: '📢' },
              { label: 'Novo orçamento', href: '/admin/orcamentos', icon: '📋' },
              { label: 'Personalizar site', href: '/admin/site', icon: '🎨' },
              { label: 'Central de chat', href: '/admin/conversas', icon: '💬' },
              { label: 'Novo produto', href: '/admin/produtos', icon: '📦' },
              { label: 'Auditoria', href: '/admin/auditoria', icon: '📝' },
            ].map(a => (
              <Link key={a.label} to={a.href}
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xl">{a.icon}</span>
                <span className="text-sm font-medium" style={{ color: '#9090a0' }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
