import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { conversationsApi, type ConversationTeamMember, type SupportConversation, type SupportMessage } from '../../api/conversations'
import { useAuth } from '../../contexts/AuthContext'
import { ChatComposer } from './ChatComposer'
import { AttachmentView } from './AttachmentView'
import { portalApi } from '../../api/portal'

export function SupportChat({ staff = false, compact = false }: { staff?: boolean; compact?: boolean }) {
  const { user } = useAuth()
  const { id } = useParams()
  const [search] = useSearchParams()
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [filter, setFilter] = useState('')
  const [team,setTeam]=useState<ConversationTeamMember[]>([])
  const [transferring,setTransferring]=useState(false)
  const end = useRef<HTMLDivElement>(null)
  const subject = search.get('assunto')
  const prompt = subject === 'orcamento'
    ? 'Conte o que você precisa para prepararmos seu orçamento.'
    : subject === 'duvida' ? 'Qual é sua dúvida? Nossa equipe vai ajudar.' : 'Como podemos ajudar você hoje?'

  useEffect(()=>{
    if(!staff)return
    let active=true
    conversationsApi.team().then(rows=>{if(active)setTeam(rows)}).catch(()=>undefined)
    return ()=>{active=false}
  },[staff])

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
    setMessagesLoading(!!selected)
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
          if (user?.id) void portalApi.markConversationRead(selected, user.id).catch(() => undefined)
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

  async function send(content: string, file: File | null, id: string) {
    if (!user || !selected) throw new Error('Selecione uma conversa.')
    const attachment = file ? await conversationsApi.upload(selected, user.id, id, file) : undefined
    const message = await conversationsApi.send(selected, user.id, content, id, attachment)
    setMessages(previous => [...previous.filter(item => item.id !== message.id), message])
  }

  const conversation = conversations.find(item => item.id === selected)
  const name = (item: SupportConversation) => `${item.customer?.first_name || 'Cliente'} ${item.customer?.last_name || ''}`.trim()
  const assigneeName=(item?:SupportConversation|null)=>{
    const person=item?.assignee
    return person ? `${person.first_name||''} ${person.last_name||''}`.trim() || 'Colaborador' : 'Não atribuído'
  }

  async function transfer(assignee:string){
    if(!conversation)return
    try{
      setTransferring(true)
      await conversationsApi.assign(conversation.id,assignee||null)
      const list=await conversationsApi.list()
      setConversations(list)
    }finally{setTransferring(false)}
  }

  async function updateCrm(values:{status?:string;priority?:string;tags?:string[]}){
    if(!conversation)return
    await conversationsApi.updateCrm(conversation.id,values)
    const list=await conversationsApi.list()
    setConversations(list)
  }
  return (
    <div className={compact ? 'h-full flex flex-col' : 'flex flex-col gap-4'} style={{ color: '#f0f0f2' }}>
      {!compact&&<div><h1 className="text-2xl font-bold">Conversas</h1><p className="text-sm" style={{ color: '#9090a0' }}>{staff ? 'Central de atendimento ao cliente' : 'Chat direto com a equipe Play Moments'}</p></div>}
      {error && <div role="alert" className="p-3 rounded-xl bg-red-950/40 text-sm">{error} <button className="underline min-h-11 px-2" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
      {loading ? <p role="status">Carregando conversas…</p> : (
        <div className={'flex flex-col md:flex-row overflow-hidden border border-white/10 '+(compact?'rounded-none h-full':'rounded-2xl')} style={{ background: '#141416', minHeight: compact ? 0 : 420 }}>
          {staff && <aside className="md:w-64 md:shrink-0 border-b md:border-r border-white/10 p-3">
            <input aria-label="Buscar cliente" placeholder="Buscar cliente…" value={filter} onChange={event => setFilter(event.target.value)} className="w-full p-3 rounded-xl bg-white/5 mb-2" />
            <div className="max-h-40 md:max-h-[60vh] overflow-auto">
              {conversations.filter(item => name(item).toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(item => (
                <button key={item.id} disabled={sending} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className="w-full text-left p-3 rounded-xl text-sm disabled:opacity-50" style={{ background: selected === item.id ? 'rgba(227,6,19,0.15)' : 'transparent' }}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{name(item)}</span><span className={'w-2 h-2 rounded-full shrink-0 '+(item.priority==='urgent'?'bg-red-500':item.priority==='high'?'bg-orange-400':item.status==='resolved'?'bg-emerald-400':'bg-gray-500')}/></div>
                  <p className="text-[10px] text-gray-500 mt-1 truncate">{assigneeName(item)}</p>
                </button>
              ))}
              {!conversations.length && <p className="text-sm p-3">Nenhuma conversa recebida ainda.</p>}
            </div>
          </aside>}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {!staff&&<span className="w-8 h-8 rounded-full bg-[#E30613] text-white flex items-center justify-center text-xs font-bold">PM</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{staff ? (conversation ? name(conversation) : 'Selecione uma conversa') : 'Play Moments'}</p>
                  {!staff&&<p className="text-[10px] text-emerald-400 font-normal">Atendimento direto</p>}
                  {staff&&conversation&&<p className="text-[10px] text-gray-500 font-normal mt-0.5">Responsável: {assigneeName(conversation)}</p>}
                </div>
              </div>
              {staff&&conversation&&<div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
                <label className="text-[10px] text-gray-500">Direcionar para
                  <select disabled={transferring} value={conversation.assigned_to||''} onChange={e=>void transfer(e.target.value)} className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-xs">
                    <option value="">Não atribuído</option>
                    {team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}{member.staff?.job_title?' — '+member.staff.job_title:member.role==='admin'?' — Admin':''}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-gray-500">Status
                  <select value={conversation.status||'open'} onChange={e=>void updateCrm({status:e.target.value})} className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-xs">
                    <option value="open">Aberta</option><option value="pending">Aguardando</option><option value="resolved">Resolvida</option>
                  </select>
                </label>
                <label className="text-[10px] text-gray-500">Prioridade
                  <select value={conversation.priority||'normal'} onChange={e=>void updateCrm({priority:e.target.value})} className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-xs">
                    <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                  </select>
                </label>
                <label className="text-[10px] text-gray-500">Tags
                  <input key={conversation.id+(conversation.tags||[]).join(',')} defaultValue={(conversation.tags||[]).join(', ')} onBlur={e=>void updateCrm({tags:e.target.value.split(',').map(tag=>tag.trim()).filter(Boolean)})} placeholder="venda, vídeo, urgente" className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-xs"/>
                </label>
              </div>}
            </div>
            {!staff && <p className="px-4 pt-4 text-sm" style={{ color: '#ff9ca6' }}>{prompt}</p>}
            <div role="log" aria-label="Mensagens" aria-live="polite" className="flex-1 overflow-auto p-4 space-y-3" style={{ height: compact ? 'auto' : '45vh', minHeight: compact ? 0 : 200 }}>
              {messagesLoading && <p role="status">Carregando mensagens…</p>}
              {!messagesLoading && selected && !messages.length && !error && <p className="text-sm text-gray-400">Nenhuma mensagem ainda. Inicie a conversa abaixo.</p>}
              {messages.map(message => <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm" style={{ background: message.sender_id === user?.id ? '#E30613' : 'rgba(255,255,255,0.07)' }}>
                  <AttachmentView message={message} />
                  <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">{new Date(message.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>)}
              <div ref={end} />
            </div>
            <ChatComposer key={selected} disabled={!selected || messagesLoading} onBusy={setSending} onSend={send} />
          </div>
        </div>
      )}
    </div>
  )
}
