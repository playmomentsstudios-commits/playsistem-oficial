import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'

const DEMO_CUSTOMERS = [
  { id: 'c1', name: 'João Silva', email: 'joao@exemplo.com', phone: '(11) 99999-9999', orders: 3, status: 'active', lastAccess: '2024-09-24' },
  { id: 'c2', name: 'Ana Costa', email: 'ana@empresa.com', phone: '(11) 88888-8888', orders: 1, status: 'active', lastAccess: '2024-09-23' },
  { id: 'c3', name: 'Marcos Lima', email: 'marcos@negocio.com', phone: '(21) 77777-7777', orders: 5, status: 'active', lastAccess: '2024-09-20' },
  { id: 'c4', name: 'Fernanda Rocha', email: 'ferna@example.com', phone: '(11) 66666-6666', orders: 0, status: 'inactive', lastAccess: '2024-08-10' },
]

export function AdminCustomers() {
  const [search, setSearch] = useState('')
  const filtered = DEMO_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Clientes</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>{DEMO_CUSTOMERS.length} clientes cadastrados</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full max-w-sm px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Header */}
        <div className="grid gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider hidden md:grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 100px 80px', color: '#6b6b78', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span>Cliente</span><span>E-mail</span><span>Telefone</span>
          <span>Pedidos</span><span>Último acesso</span><span>Status</span>
        </div>

        {filtered.map((c, i) => (
          <div key={c.id}
            className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors cursor-pointer"
            style={{
              gridTemplateColumns: '1fr',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
            }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
                  {c.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#6b6b78' }}>{c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm hidden md:block" style={{ color: '#9090a0' }}>{c.phone}</span>
                <span className="text-sm" style={{ color: '#f0f0f2' }}>{c.orders} pedidos</span>
                <span className="text-xs hidden md:block" style={{ color: '#6b6b78' }}>
                  {new Date(c.lastAccess).toLocaleDateString('pt-BR')}
                </span>
                <Badge variant={c.status === 'active' ? 'success' : 'default'}>
                  {c.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
