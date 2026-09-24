import { useState } from 'react'
import type { Message, Conversation } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

// Seed conversation data
const SEED_CONVERSATION: Conversation = {
  id: 'conv-1',
  participants: ['customer-1', 'admin-1'],
  customerId: 'customer-1',
  customerName: 'João Silva',
  lastMessage: 'Ok! Aguardo o arquivo final.',
  lastMessageAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  unreadCount: 2,
  status: 'open',
  createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
}

const SEED_MESSAGES: Message[] = [
  { id: 'm1', conversationId: 'conv-1', senderId: 'admin-1', senderRole: 'admin', senderName: 'Play Moments', type: 'text', content: 'Olá! A identidade visual está praticamente pronta. Vamos alinhar os últimos detalhes?', status: 'read', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm2', conversationId: 'conv-1', senderId: 'customer-1', senderRole: 'customer', senderName: 'João Silva', type: 'text', content: 'Ótimo! Claro, pode mandar os arquivos para revisão.', status: 'read', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm3', conversationId: 'conv-1', senderId: 'admin-1', senderRole: 'admin', senderName: 'Play Moments', type: 'text', content: 'Ajustamos as cores conforme sua solicitação. Ficou muito melhor! Veja o preview em anexo.', status: 'read', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm4', conversationId: 'conv-1', senderId: 'customer-1', senderRole: 'customer', senderName: 'João Silva', type: 'text', content: 'Ok! Aguardo o arquivo final.', status: 'read', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() },
]

function groupByDay(messages: Message[]) {
  const groups: Record<string, Message[]> = {}
  messages.forEach(m => {
    const day = new Date(m.createdAt).toLocaleDateString('pt-BR')
    if (!groups[day]) groups[day] = []
    groups[day].push(m)
  })
  return groups
}

export function ConversationsPage() {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES)
  const [sending, setSending] = useState(false)

  const handleSend = () => {
    if (!text.trim() || !user) return
    setSending(true)
    const msg: Message = {
      id: `m-${Date.now()}`,
      conversationId: 'conv-1',
      senderId: user.id,
      senderRole: user.role,
      senderName: `${user.name} ${user.lastName}`,
      type: 'text',
      content: text.trim(),
      status: 'sending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
    setText('')
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'sent' } : m))
      setSending(false)
    }, 800)
  }

  const grouped = groupByDay(messages)
  const isMe = (msg: Message) => msg.senderId === user?.id

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Conversas</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Chat direto com a equipe Play Moments</p>
      </div>

      <div className="flex-1 flex rounded-2xl overflow-hidden"
        style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)', minHeight: 0 }}>

        {/* Conversation list (left) */}
        <div className="hidden md:flex flex-col border-r" style={{ width: 260, borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input placeholder="Buscar conversa..." className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {[SEED_CONVERSATION].map(conv => (
              <div key={conv.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                style={{ background: 'rgba(227,6,19,0.08)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
                  PM
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>Play Moments</p>
                    <p className="text-xs" style={{ color: '#6b6b78' }}>5min</p>
                  </div>
                  <p className="text-xs truncate" style={{ color: '#9090a0' }}>{conv.lastMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
              PM
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>Play Moments</p>
              <p className="text-xs" style={{ color: '#06d6a0' }}>● Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {Object.entries(grouped).map(([day, dayMsgs]) => (
              <div key={day}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b6b78' }}>
                    {day}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {dayMsgs.map(msg => (
                    <div key={msg.id} className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm"
                        style={{
                          background: isMe(msg) ? '#E30613' : 'rgba(255,255,255,0.07)',
                          color: isMe(msg) ? '#fff' : '#f0f0f2',
                          borderRadius: isMe(msg) ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        }}>
                        {!isMe(msg) && <p className="text-xs font-semibold mb-1" style={{ color: '#ff6b7a', opacity: 0.9 }}>{msg.senderName}</p>}
                        <p style={{ lineHeight: 1.5 }}>{msg.content}</p>
                        <p className="text-xs mt-1 text-right" style={{ opacity: 0.6 }}>
                          {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {isMe(msg) && ' ' + (msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-3 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }}
            />
            <Button onClick={handleSend} loading={sending} disabled={!text.trim()}>
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
