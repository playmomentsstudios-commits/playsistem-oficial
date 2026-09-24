import { useState } from 'react'
import { Button } from '../../components/ui/Button'

const CONVERSATIONS = [
  { id: 'c1', customer: 'João Silva', avatar: 'J', lastMsg: 'Ok! Aguardo o arquivo final.', time: '5min', unread: 0, online: true },
  { id: 'c2', customer: 'Ana Costa', avatar: 'A', lastMsg: 'Quando fica pronto o site?', time: '1h', unread: 2, online: false },
  { id: 'c3', customer: 'Marcos Lima', avatar: 'M', lastMsg: 'Adorei o resultado da campanha!', time: '3h', unread: 0, online: false },
]

const MESSAGES = [
  { id: 'm1', sender: 'customer', name: 'João Silva', content: 'Olá! Queria saber sobre o andamento da identidade visual.', time: '09:00', date: 'Hoje' },
  { id: 'm2', sender: 'admin', name: 'Play Moments', content: 'Olá, João! Está quase pronta. Vamos alinhar os últimos detalhes.', time: '09:05', date: 'Hoje' },
  { id: 'm3', sender: 'customer', name: 'João Silva', content: 'Ótimo! Pode mandar os arquivos para revisão.', time: '09:07', date: 'Hoje' },
  { id: 'm4', sender: 'admin', name: 'Play Moments', content: 'Ajustamos as cores. Ficou muito melhor! Veja o preview.', time: '14:30', date: 'Hoje' },
  { id: 'm5', sender: 'customer', name: 'João Silva', content: 'Ok! Aguardo o arquivo final.', time: '14:45', date: 'Hoje' },
]

export function AdminConversations() {
  const [selected, setSelected] = useState('c1')
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState(MESSAGES)

  const handleSend = () => {
    if (!text.trim()) return
    setMsgs(prev => [...prev, {
      id: `m-${Date.now()}`, sender: 'admin', name: 'Play Moments',
      content: text.trim(), time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), date: 'Hoje',
    }])
    setText('')
  }

  const conv = CONVERSATIONS.find(c => c.id === selected)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Conversas</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Central de atendimento ao cliente</p>
      </div>

      <div className="flex rounded-2xl overflow-hidden"
        style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.07)', height: 'calc(100vh - 180px)' }}>

        {/* Left: list */}
        <div className="flex-shrink-0 flex flex-col border-r" style={{ width: 280, borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input placeholder="Buscar cliente..." className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {CONVERSATIONS.map(conv => (
              <div key={conv.id} onClick={() => setSelected(conv.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{
                  background: selected === conv.id ? 'rgba(227,6,19,0.08)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
                    {conv.avatar}
                  </div>
                  {conv.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: '#06d6a0', borderColor: '#141416' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{conv.customer}</p>
                    <p className="text-xs" style={{ color: '#6b6b78' }}>{conv.time}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs truncate" style={{ color: '#9090a0' }}>{conv.lastMsg}</p>
                    {conv.unread > 0 && (
                      <span className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: '#E30613', color: '#fff', fontSize: 9 }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: chat */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #E30613, #ff4d6d)', color: '#fff' }}>
                {conv?.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>{conv?.customer}</p>
                <p className="text-xs" style={{ color: conv?.online ? '#06d6a0' : '#6b6b78' }}>
                  {conv?.online ? '● Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {msgs.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-sm px-4 py-2.5 rounded-2xl text-sm"
                  style={{
                    background: msg.sender === 'admin' ? '#E30613' : 'rgba(255,255,255,0.07)',
                    color: '#fff',
                    borderRadius: msg.sender === 'admin' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  }}>
                  <p style={{ lineHeight: 1.5 }}>{msg.content}</p>
                  <p className="text-xs mt-1 text-right" style={{ opacity: 0.6 }}>{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-3 p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f2' }} />
            <Button onClick={handleSend} disabled={!text.trim()}>Enviar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
