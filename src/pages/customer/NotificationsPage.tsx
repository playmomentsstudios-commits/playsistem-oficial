import { useState } from 'react'
import type { Notification } from '../../types'

const DEMO_NOTIFS: Notification[] = [
  { id: 'n1', userId: 'customer-1', type: 'order_updated', title: 'Pedido PM-000001 atualizado', message: 'Seu pedido entrou em produção. Acompanhe o progresso no seu portal.', referenceType: 'order', referenceId: 'o1', read: false, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: 'n2', userId: 'customer-1', type: 'new_message', title: 'Nova mensagem', message: 'A equipe Play Moments enviou uma atualização sobre seu projeto.', referenceType: 'conversation', referenceId: 'conv-1', read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'n3', userId: 'customer-1', type: 'quote_received', title: 'Orçamento ORC-000002 disponível', message: 'Você tem um novo orçamento aguardando sua revisão.', referenceType: 'quote', referenceId: 'q2', read: true, readAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: 'n4', userId: 'customer-1', type: 'payment_confirmed', title: 'Pagamento confirmado', message: 'O pagamento do pedido PM-000002 foi confirmado. Obrigado!', referenceType: 'order', referenceId: 'o2', read: true, createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
]

const TYPE_ICON: Record<string, string> = {
  new_message: '💬',
  order_updated: '📦',
  order_created: '🛒',
  payment_confirmed: '✅',
  payment_pending: '⏳',
  quote_received: '📋',
  file_received: '📁',
  new_post: '📢',
  message_read: '👁',
}

export function NotificationsPage() {
  const [notifs, setNotifs] = useState(DEMO_NOTIFS)

  const markRead = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
  }

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })))
  }

  const unread = notifs.filter(n => !n.read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Notificações</h1>
          <p className="text-sm" style={{ color: '#6b6b78' }}>
            {unread > 0 ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia!'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm" style={{ color: '#E30613' }}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {notifs.map(n => (
          <div key={n.id}
            onClick={() => markRead(n.id)}
            className="flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all"
            style={{
              background: n.read ? 'rgba(255,255,255,0.03)' : 'rgba(227,6,19,0.06)',
              border: `1px solid ${n.read ? 'rgba(255,255,255,0.06)' : 'rgba(227,6,19,0.15)'}`,
            }}>
            <span className="text-2xl flex-shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: n.read ? '#c0c0cc' : '#f0f0f2' }}>{n.title}</p>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E30613' }} />
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#6b6b78', lineHeight: 1.5 }}>{n.message}</p>
              <p className="text-xs mt-1" style={{ color: '#4a4a55' }}>
                {new Date(n.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
