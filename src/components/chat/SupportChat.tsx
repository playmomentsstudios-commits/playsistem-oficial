import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { conversationsApi, type SupportConversation, type SupportMessage } from '../../api/conversations'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'

export function SupportChat({ staff = false }: { staff?: boolean }) {
  const { user } = useAuth()
  const { id } = useParams()
  const [search] = useSearchParams()
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [retry, setRetry] = useState(0)
  const [filter, setFilter] = useState('')
  const pending = useRef<{ id: string; conversation: string; content: string } | null>(null)
  const sendingRef = useRef(false)
  const end = useRef<HTMLDivElement>(null)
  const subject = search.get('assunto')
  const prompt = subject === 'orcamento'
    ? 'Conte o que você precisa para prepararmos seu orçamento.'
    : subject === 'duvida' ? 'Qual é sua dúvida? Nossa equipe vai ajudar.' : 'Como podemos ajudar você hoje?'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      try {
        const ownId = staff ? null : await conversationsApi.open()
        const list = await conversationsApi.list()
        if (!active) return
        if (id && !list.some(item => item.id === id)) throw new Error('Conversa indisponível.')
        setConversations(list)
        setSelected(current => id || ownId || (list.some(item => item.id === current) ? current : list[0]?.id) || '')
      } catch {
        if (active) setError('Não foi possível carregar as conversas. Tente novamente.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const timer = staff ? window.setInterval(() => {
      conversationsApi.list().then(list => {
        if (!active) return
        setConversations(list)
        setSelected(current => current || list[0]?.id || '')
      }).catch(() => { if (active) setError('Não foi possível atualizar as conversas. Tente novamente.') })
    }, 10000) : undefined
    return () => { active = false; window.clearInterval(timer) }
  }, [staff, id, user?.id, retry])

  useEffect(() => {
    setMessages([])
    setText('')
    setSendError('')
    setMessagesLoading(!!selected)
    pending.current = null
  }, [selected])

  useEffect(() => {
    let active = true
    let busy = false
    async function refresh() {
      if (!selected || busy) return
      busy = true
      try {
        const result = await conversationsApi.messages(selected)
        if (active) {
          // Preserve confirmed sends if polling started just before the send.
          setMessages(previous => [...new Map([...result, ...previous].map(message => [message.id, message])).values()]
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)))
          setError('')
        }
      } catch {
        if (active) setError('Não foi possível atualizar as mensagens. Tente novamente.')
      } finally {
        busy = false
        if (active) setMessagesLoading(false)
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [selected, retry])

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const content = text.trim()
    if (!content || !user || !selected || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError('')
    if (pending.current?.content !== content || pending.current?.conversation !== selected) {
      pending.current = { id: crypto.randomUUID(), conversation: selected, content }
    }
    try {
      const message = await conversationsApi.send(selected, user.id, content, pending.current.id)
      setMessages(previous => [...previous.filter(item => item.id !== message.id), message])
      setText('')
      pending.current = null
    } catch {
      setSendError('Mensagem não confirmada. Seu texto foi mantido; tente enviar novamente.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const conversation = conversations.find(item => item.id === selected)
  const name = (item: SupportConversation) => `${item.customer?.first_name || 'Cliente'} ${item.customer?.last_name || ''}`.trim()
  return (
    <div className="flex flex-col gap-4" style={{ color: '#f0f0f2' }}>
      <div><h1 className="text-2xl font-bold">Conversas</h1><p className="text-sm" style={{ color: '#9090a0' }}>{staff ? 'Central de atendimento ao cliente' : 'Chat direto com a equipe Play Moments'}</p></div>
      {error && <div role="alert" className="p-3 rounded-xl bg-red-950/40 text-sm">{error} <button className="underline min-h-11 px-2" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
      {loading ? <p role="status">Carregando conversas…</p> : (
        <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden border border-white/10" style={{ background: '#141416', minHeight: 420 }}>
          {staff && <aside className="md:w-64 md:shrink-0 border-b md:border-r border-white/10 p-3">
            <input aria-label="Buscar cliente" placeholder="Buscar cliente…" value={filter} onChange={event => setFilter(event.target.value)} className="w-full p-3 rounded-xl bg-white/5 mb-2" />
            <div className="max-h-40 md:max-h-[60vh] overflow-auto">
              {conversations.filter(item => name(item).toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(item => (
                <button key={item.id} disabled={sending} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className="w-full text-left p-3 rounded-xl text-sm disabled:opacity-50" style={{ background: selected === item.id ? 'rgba(227,6,19,0.15)' : 'transparent' }}>{name(item)}</button>
              ))}
              {!conversations.length && <p className="text-sm p-3">Nenhuma conversa recebida ainda.</p>}
            </div>
          </aside>}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 py-4 border-b border-white/10 font-semibold">{staff ? (conversation ? name(conversation) : 'Selecione uma conversa') : 'Play Moments'}</div>
            {!staff && <p className="px-4 pt-4 text-sm" style={{ color: '#ff9ca6' }}>{prompt}</p>}
            <div role="log" aria-label="Mensagens" aria-live="polite" className="flex-1 overflow-auto p-4 space-y-3" style={{ height: '45vh', minHeight: 200 }}>
              {messagesLoading && <p role="status">Carregando mensagens…</p>}
              {!messagesLoading && selected && !messages.length && !error && <p className="text-sm text-gray-400">Nenhuma mensagem ainda. Inicie a conversa abaixo.</p>}
              {messages.map(message => <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm" style={{ background: message.sender_id === user?.id ? '#E30613' : 'rgba(255,255,255,0.07)' }}>
                  <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">{new Date(message.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>)}
              <div ref={end} />
            </div>
            {sendError && <p role="alert" className="px-4 pb-3 text-sm text-red-300">{sendError}</p>}
            <form onSubmit={send} className="flex items-end gap-2 p-3 border-t border-white/10">
              <textarea aria-label="Mensagem" placeholder="Digite sua mensagem…" value={text} maxLength={5000} rows={2} disabled={!selected || sending} onChange={event => setText(event.target.value)} className="flex-1 min-w-0 p-3 rounded-xl text-sm bg-white/5 resize-none" />
              <Button type="submit" loading={sending} disabled={!selected || !text.trim() || messagesLoading}>Enviar</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
