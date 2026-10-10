import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { conversationsApi, type ConversationTeamMember, type SupportConversation, type SupportMessage } from '../../api/conversations'
import { useAuth } from '../../contexts/AuthContext'
import { ChatComposer } from './ChatComposer'
import { AttachmentView } from './AttachmentView'
import { portalApi } from '../../api/portal'
import { SagamenteMotion } from '../ui/SagamenteMotion'

type InboxFilter='all'|'unread'|'mine'|'unassigned'|'urgent'
const statusLabel:Record<string,string>={open:'Aberta',pending:'Aguardando',resolved:'Resolvida'}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL'}
function shortTime(value?:string|null){
  if(!value)return ''
  const date=new Date(value),now=new Date()
  return date.toDateString()===now.toDateString()?date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
}

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
  const [deletingMessage,setDeletingMessage] = useState<string|null>(null)
  const [selectedMessages,setSelectedMessages] = useState<string[]>([])
  const [bulkDeleting,setBulkDeleting] = useState(false)
  const messageViewport = useRef<HTMLDivElement>(null)
  const longPress = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [filter, setFilter] = useState('')
  const [inboxFilter,setInboxFilter]=useState<InboxFilter>('all')
  const [infoOpen,setInfoOpen]=useState(false)
  const [mobileChat,setMobileChat]=useState(false)
  const [team,setTeam]=useState<ConversationTeamMember[]>([])
  const [customerAvatar,setCustomerAvatar]=useState<string|null>(null)
  const [lastReadAt,setLastReadAt]=useState<string|null>(null)
  const [staffPermissions,setStaffPermissions]=useState<string[]>([])
  const [transferring,setTransferring]=useState(false)
  const subject = search.get('assunto')
  const prompt = subject === 'orcamento'
    ? 'Conte o que você precisa para prepararmos seu orçamento.'
    : subject === 'duvida' ? 'Qual é sua dúvida? Nossa equipe vai ajudar.' : 'Como podemos ajudar você hoje?'

  async function loadConversationList(){
    if(!user?.id)return []
    return staff?conversationsApi.listWithSummary(user.id):conversationsApi.list()
  }

  useEffect(()=>{
    if(!staff)return
    let active=true
    Promise.all([
      conversationsApi.team(),
      user?.role==='staff'?portalApi.myStaffProfile():Promise.resolve(null),
    ]).then(([rows,profile])=>{
      if(!active)return
      setTeam(rows)
      setStaffPermissions(profile?.permissions||[])
    }).catch(()=>undefined)
    return ()=>{active=false}
  },[staff,user?.role,user?.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      try {
        const ownId = staff ? null : await conversationsApi.open()
        const list = await loadConversationList()
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
      loadConversationList().then(list => {
        if (!active) return
        setConversations(list)
        setSelected(current => current || list[0]?.id || '')
      }).catch(() => { if (active) setError('Não foi possível atualizar as conversas. Tente novamente.') })
    }, 10000) : undefined
    return () => { active = false; window.clearInterval(timer) }
  }, [staff, id, user?.id, retry])

  useEffect(() => {
    setMessages([])
    setSelectedMessages([])
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
          setMessages(previous => [...new Map([...previous, ...result].map(message => [message.id, message])).values()]
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)))
          setError('')
          if (user?.id) {
            void portalApi.markConversationRead(selected, user.id).catch(() => undefined)
            setConversations(previous=>previous.map(item=>item.id===selected?{...item,unread_count:0}:item))
          }
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

  useEffect(() => {
    const pane = messageViewport.current
    if (pane && !messagesLoading) pane.scrollTop = pane.scrollHeight
  }, [selected, messagesLoading, messages.length, messages.at(-1)?.id])
  useEffect(() => () => { if (longPress.current) clearTimeout(longPress.current) }, [])
  function toggleMessage(id:string) {
    setSelectedMessages(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id])
  }
  async function deleteSelectedMessages() {
    if (bulkDeleting || !selectedMessages.length) return
    const ids = [...selectedMessages]
    if (!window.confirm('Excluir '+ids.length+' mensagem(ns) para todos?')) return
    setBulkDeleting(true)
    let failed=0
    for (const id of ids) {
      try {
        await conversationsApi.deleteOwnMessage(id)
        setMessages(previous=>previous.map(item=>item.id===id?{...item,deleted_at:new Date().toISOString()}:item))
      } catch { failed++ }
    }
    setSelectedMessages([])
    setBulkDeleting(false)
    if (failed) setError('Não foi possível excluir '+failed+' mensagem(ns). Tente novamente.')
  }

  async function deleteMessage(messageId:string) {
    if (!user?.id || deletingMessage) return
    setDeletingMessage(messageId)
    try {
      await conversationsApi.deleteOwnMessage(messageId)
      setMessages(previous=>previous.map(item=>item.id===messageId?{...item,deleted_at:new Date().toISOString()}:item))
    } catch { setError('Não foi possível excluir a mensagem. Tente novamente.') }
    finally { setDeletingMessage(null) }
  }
  async function send(content: string, file: File | null, id: string) {
    if (!user || !selected) throw new Error('Selecione uma conversa.')
    const attachment = file ? await conversationsApi.upload(selected, user.id, id, file) : undefined
    const message = await conversationsApi.send(selected, user.id, content, id, attachment)
    setMessages(previous => [...previous.filter(item => item.id !== message.id), message])
    setConversations(previous=>previous.map(item=>item.id===selected?{...item,last_message:message.content,last_message_at:message.created_at,last_sender_id:user.id,unread_count:0}:item).sort((a,b)=>(b.last_message_at||'').localeCompare(a.last_message_at||'')))
  }

  useEffect(()=>{if(!selected)return;let active=true;setCustomerAvatar(null);const customerId=conversations.find(item=>item.id===selected)?.customer_id;if(!customerId)return;void import('../../lib/supabase').then(({supabase})=>supabase.from('profiles').select('avatar_url').eq('id',customerId).maybeSingle()).then(({data})=>{if(active)setCustomerAvatar(data?.avatar_url||null)}).catch(()=>undefined);return()=>{active=false}},[selected,conversations])
  useEffect(()=>{if(!selected||!user?.id)return;let active=true;const refresh=async()=>{try{const {supabase}=await import('../../lib/supabase');const conversation=conversations.find(item=>item.id===selected);const recipient=staff?conversation?.customer_id:null;if(!recipient){if(active)setLastReadAt(null);return}const {data}=await supabase.from('conversation_reads').select('last_read_at').eq('conversation_id',selected).eq('user_id',recipient).maybeSingle();if(active)setLastReadAt(data?.last_read_at||null)}catch{if(active)setLastReadAt(null)}};void refresh();const timer=window.setInterval(()=>void refresh(),5000);return()=>{active=false;window.clearInterval(timer)}},[selected,user?.id,staff,conversations])
  const conversation = conversations.find(item => item.id === selected)
  const name = (item: SupportConversation) => `${item.customer?.first_name || 'Cliente'} ${item.customer?.last_name || ''}`.trim()
  const assigneeName=(item?:SupportConversation|null)=>{
    const person=item?.assignee
    return person ? `${person.first_name||''} ${person.last_name||''}`.trim() || 'Colaborador' : 'Não atribuído'
  }

  const canTransfer=user?.role==='admin'||staffPermissions.includes('*')||staffPermissions.includes('conversations.transfer')

  async function transfer(assignee:string){
    if(!conversation)return
    try{
      setTransferring(true)
      await conversationsApi.assign(conversation.id,assignee||null)
      const list=await loadConversationList()
      setConversations(list)
    }finally{setTransferring(false)}
  }

  async function updateCrm(values:{status?:string;priority?:string;tags?:string[]}){
    if(!conversation)return
    await conversationsApi.updateCrm(conversation.id,values)
    const list=await loadConversationList()
    setConversations(list)
  }
  const counts=useMemo(()=>({
    unread:conversations.filter(item=>(item.unread_count||0)>0).length,
    mine:conversations.filter(item=>item.assigned_to===user?.id).length,
    unassigned:conversations.filter(item=>!item.assigned_to).length,
    urgent:conversations.filter(item=>item.priority==='urgent').length,
  }),[conversations,user?.id])

  const visibleConversations=useMemo(()=>conversations.filter(item=>{
    const term=filter.trim().toLocaleLowerCase()
    const matchesText=!term||name(item).toLocaleLowerCase().includes(term)||(item.last_message||'').toLocaleLowerCase().includes(term)||(item.tags||[]).some(tag=>tag.toLocaleLowerCase().includes(term))
    const matchesFilter=inboxFilter==='all'||(inboxFilter==='unread'&&(item.unread_count||0)>0)||(inboxFilter==='mine'&&item.assigned_to===user?.id)||(inboxFilter==='unassigned'&&!item.assigned_to)||(inboxFilter==='urgent'&&item.priority==='urgent')
    return matchesText&&matchesFilter
  }),[conversations,filter,inboxFilter,user?.id])

  return (
    <div className={compact ? 'h-full flex flex-col' : 'flex flex-col gap-3 min-h-0'} style={{ color: '#f0f0f2' }}>
      {!compact&&<div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Conversas</h1><p className="text-sm text-gray-500">{staff ? 'Central de atendimento ao cliente' : 'Chat direto com a equipe Sagamente'}</p></div>{staff&&<div className="flex items-center gap-2 text-xs text-gray-500"><span>{counts.unread} não lida(s)</span><span>•</span><span>{counts.unassigned} sem responsável</span></div>}</div>}
      {error && <div role="alert" className="p-3 rounded-xl bg-red-950/40 text-sm">{error} <button className="underline min-h-11 px-2" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
      {loading ? <p role="status">Carregando conversas…</p> : (
        <div className={'relative flex overflow-hidden bg-[#141416] '+(compact?'rounded-none h-full':'md:rounded-2xl md:border md:border-white/10 h-[calc(100dvh-160px)] min-h-[320px] md:h-[calc(100dvh-150px)] md:min-h-[500px]')}>
          {staff && <aside className={'w-full md:w-[330px] xl:w-[360px] shrink-0 border-white/10 bg-[#101012] flex-col '+(mobileChat?'hidden md:flex':'flex')+' md:border-r'}>
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div><p className="text-sm font-bold">Caixa de entrada</p><p className="text-[10px] text-gray-500">{conversations.length} conversa(s)</p></div>
                {counts.unread>0&&<span className="pm-tag pm-tag-danger">{counts.unread} não lida(s)</span>}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">⌕</span>
                <input aria-label="Buscar conversa" placeholder="Buscar cliente, mensagem ou marcador…" value={filter} onChange={event => setFilter(event.target.value)} className="w-full min-h-11 pl-9 pr-3 rounded-xl bg-white/[.05] border border-white/10 text-sm" />
              </div>
              <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                {([
                  ['all','Todas',conversations.length],
                  ['unread','Não lidas',counts.unread],
                  ['mine','Minhas',counts.mine],
                  ['unassigned','Sem responsável',counts.unassigned],
                  ['urgent','Urgentes',counts.urgent],
                ] as Array<[InboxFilter,string,number]>).map(([value,label,count])=><button type="button" key={value} onClick={()=>setInboxFilter(value)} className={'shrink-0 min-h-8 px-2.5 rounded-lg border text-[10px] font-semibold '+(inboxFilter===value?'border-[#A65A2A]/40 bg-[#A65A2A]/10 text-red-200':'border-white/10 bg-white/[.025] text-gray-400')}>{label}{count>0&&value!=='all'?(' '+count):''}</button>)}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {visibleConversations.map(item=>{
                const itemName=name(item)
                const unread=item.unread_count||0
                return <button key={item.id} disabled={sending} aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setMobileChat(true);setInfoOpen(false)}} className={'w-full text-left px-3 py-3.5 border-b border-white/[.05] hover:bg-white/[.035] transition-colors disabled:opacity-50 '+(selected===item.id?'bg-white/[.045]':'')}>
                  <div className="flex gap-3">
                    <div className="relative shrink-0">
                      <div className={'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold '+(selected===item.id?'bg-[#A65A2A] text-white':'bg-white/[.07] text-gray-300')}>{initials(itemName)}</div>
                      {item.priority==='urgent'&&<span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#101012]"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 items-baseline">
                        <p className={'text-sm truncate '+(unread?'font-bold text-white':'font-semibold text-gray-200')}>{itemName}</p>
                        <span className={'text-[10px] shrink-0 '+(unread?'text-[#ff6573]':'text-gray-600')}>{shortTime(item.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={'text-xs truncate flex-1 '+(unread?'text-gray-300':'text-gray-500')}>{item.last_sender_id===user?.id?'Você: ':''}{item.last_message||'Conversa iniciada'}</p>
                        {unread>0&&<span className="min-w-5 h-5 px-1 rounded-full bg-[#A65A2A] text-white text-[10px] font-bold flex items-center justify-center">{unread>99?'99+':unread}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 min-w-0">
                        <span className={"pm-tag "+(item.status==='resolved'?'pm-tag-success':item.status==='pending'?'pm-tag-pending':'pm-tag-info')}>{statusLabel[item.status||'open']}</span>
                        <span className="text-[10px] text-gray-600 truncate">{assigneeName(item)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              })}
              {!visibleConversations.length&&<div className="p-6 text-center"><p className="text-sm text-gray-400">Nenhuma conversa encontrada.</p><p className="text-xs text-gray-600 mt-1">Tente outro filtro ou termo de busca.</p></div>}
            </div>
          </aside>}
          <div className={"flex-1 min-w-0 flex-col "+(staff&&!mobileChat?"hidden md:flex":"flex")}>
            <div className="min-h-[64px] px-3 md:px-4 border-b border-white/10 flex items-center gap-3 bg-[#141416]/95 backdrop-blur shrink-0">
              {staff&&<button onClick={()=>setMobileChat(false)} className="md:hidden w-9 h-9 rounded-lg hover:bg-white/[.05] text-gray-300" aria-label="Voltar para conversas">←</button>}
              <div className={'w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 '+(staff?'bg-white/[.07]':'bg-[#171719] text-white')}>{staff?(customerAvatar?<img src={customerAvatar} alt="Foto do cliente" className="w-full h-full object-cover"/>:conversation?initials(name(conversation)):'CL'):<SagamenteMotion size={25} monochrome="#FFFFFF" animate={false} label="Sagamente"/>}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{staff ? (conversation ? name(conversation) : 'Selecione uma conversa') : 'Sagamente'}</p>
                {!staff&&<p className="text-[10px] text-emerald-400">Conversa com a equipe</p>}
                {staff&&conversation&&<div className="flex items-center gap-1.5 mt-0.5"><span className="text-[10px] text-gray-500 truncate">{assigneeName(conversation)}</span><span className="text-gray-700">•</span><span className="text-[10px] text-gray-500">{statusLabel[conversation.status||'open']}</span></div>}
              </div>
              {staff&&conversation&&<button onClick={()=>setInfoOpen(true)} className="min-h-10 px-3 rounded-xl border border-white/10 hover:bg-white/[.05] text-xs font-semibold">Informações</button>}
            </div>
            {!staff&&subject&&<p className="shrink-0 border-b border-white/10 px-4 py-2 text-xs text-[#DFA269]">{prompt}</p>}
            {selectedMessages.length>0&&<div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#1b1b1e]"><span className="text-xs text-gray-200">{selectedMessages.length} selecionada(s)</span><div className="flex gap-2"><button type="button" onClick={()=>setSelectedMessages([])} className="text-xs px-2 py-2 text-gray-300">Cancelar</button><button type="button" disabled={bulkDeleting} onClick={()=>void deleteSelectedMessages()} className="text-xs px-3 py-2 rounded-lg bg-red-500/20 text-red-200 disabled:opacity-50">{bulkDeleting?'Excluindo…':'Excluir selecionadas'}</button></div></div>}
            <div ref={messageViewport} role="log" aria-label="Mensagens" aria-live="polite" className="flex-1 overflow-y-auto min-h-0 px-3 md:px-5 py-3 bg-[#0f0f11]">
              {messagesLoading && <p role="status">Carregando mensagens…</p>}
              {!messagesLoading && selected && !messages.length && !error && <p className="text-sm text-gray-400">Nenhuma mensagem ainda. Inicie a conversa abaixo.</p>}
              {messages.map((message,index) => {
                const mine=message.sender_id===user?.id
                const previous=messages[index-1]
                const next=messages[index+1]
                const samePrevious=previous?.sender_id===message.sender_id
                const sameNext=next?.sender_id===message.sender_id
                const dayChanged=!previous||new Date(previous.created_at).toDateString()!==new Date(message.created_at).toDateString()
                const day=new Date(message.created_at)
                const today=new Date()
                const yesterday=new Date();yesterday.setDate(today.getDate()-1)
                const label=day.toDateString()===today.toDateString()?'Hoje':day.toDateString()===yesterday.toDateString()?'Ontem':day.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})
                return <div key={message.id}>
                  {dayChanged&&<div className="flex justify-center py-3"><span className="px-2.5 py-1 rounded-full bg-black/35 border border-white/[.05] text-[10px] text-gray-500">{label}</span></div>}
                  <div className={`flex items-center gap-2 ${mine?'justify-end':'justify-start'} ${sameNext?'mb-[3px]':'mb-2'}`}>
                    {selectedMessages.length>0&&mine&&!message.deleted_at&&<input type="checkbox" aria-label="Selecionar mensagem" checked={selectedMessages.includes(message.id)} onChange={()=>toggleMessage(message.id)} className="accent-orange-500 shrink-0 w-4 h-4" />}
                     <div onContextMenu={event=>{if(mine&&!message.deleted_at){event.preventDefault();toggleMessage(message.id)}}} onTouchStart={()=>{if(mine&&!message.deleted_at)longPress.current=setTimeout(()=>toggleMessage(message.id),550)}} onTouchEnd={()=>{if(longPress.current)clearTimeout(longPress.current)}} onTouchMove={()=>{if(longPress.current)clearTimeout(longPress.current)}} className={`max-w-[94%] md:max-w-[78%] ${message.attachment_type?.startsWith('image/')?'w-[min(640px,94%)] p-1.5':'px-3 py-2'} text-[13px] md:text-sm leading-[1.35] shadow-sm ${mine?'bg-[#A65A2A] text-white':'bg-[#232326] text-gray-100'} ${mine?(samePrevious?'rounded-tr-md':'rounded-tr-[18px]'):(samePrevious?'rounded-tl-md':'rounded-tl-[18px]')} ${mine?(sameNext?'rounded-br-md':'rounded-br-[18px]'):(sameNext?'rounded-bl-md':'rounded-bl-[18px]')} rounded-l-[18px] rounded-r-[18px]`}>
                      {message.deleted_at?<p className="italic text-xs opacity-70">Mensagem excluída</p>:<AttachmentView message={message} />}
                      {!message.deleted_at&&message.content&&<p className="whitespace-pre-wrap break-words px-1" style={{ overflowWrap:'anywhere' }}>{message.content}</p>}
                      <p className="text-[9px] mt-1 opacity-70 text-right leading-none flex justify-end items-center gap-1">{mine&&!message.deleted_at&&selectedMessages.length===0&&<button type="button" disabled={!!deletingMessage} onClick={()=>{if(window.confirm('Excluir esta mensagem para todos?'))void deleteMessage(message.id)}} className="underline mr-2" aria-label="Excluir mensagem para todos">Excluir</button>}{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{mine&&<span title={lastReadAt&&new Date(lastReadAt).getTime()>=new Date(message.created_at).getTime()?'Visualizada':'Enviada'} aria-label={lastReadAt&&new Date(lastReadAt).getTime()>=new Date(message.created_at).getTime()?'Visualizada':'Enviada'} className={lastReadAt&&new Date(lastReadAt).getTime()>=new Date(message.created_at).getTime()?'text-orange-200':'text-white/65'}>{lastReadAt&&new Date(lastReadAt).getTime()>=new Date(message.created_at).getTime()?'✓✓':'✓'}</span>}</p>
                    </div>
                  </div>
                </div>
              })}

            </div>
            <div className="shrink-0 bg-[#141416] border-t border-white/10"><ChatComposer key={selected} disabled={!selected || messagesLoading} onBusy={setSending} onSend={send} compact staff={staff} customerId={conversation?.customer_id} /></div>
          </div>
          {infoOpen&&staff&&conversation&&<button className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={()=>setInfoOpen(false)} aria-label="Fechar informações"/>}
          {infoOpen&&staff&&conversation&&<aside className="fixed inset-y-0 right-0 z-50 w-[88vw] max-w-sm md:static md:z-auto md:w-[300px] md:max-w-none shrink-0 border-l border-white/10 bg-[#111113] overflow-y-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#111113]/95 backdrop-blur z-10">
              <div><p className="text-sm font-bold">Informações</p><p className="text-[10px] text-gray-500">Atendimento e contexto</p></div>
              <button onClick={()=>setInfoOpen(false)} className="w-9 h-9 rounded-lg hover:bg-white/[.05] text-gray-400" aria-label="Fechar informações">✕</button>
            </div>
            <div className="p-4 space-y-5">
              <section className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#A65A2A]/15 text-[#ff6573] mx-auto flex items-center justify-center font-bold">{initials(name(conversation))}</div>
                <p className="font-bold mt-3">{name(conversation)}</p>
                <p className="text-xs text-gray-500 mt-1">Cliente Sagamente</p>
              </section>
              <section className="space-y-3">
                <label className="block text-[10px] uppercase tracking-wide text-gray-500">Responsável
                  <select disabled={transferring||!canTransfer} value={conversation.assigned_to||''} onChange={e=>void transfer(e.target.value)} className="mt-1.5 w-full min-h-11 px-3 rounded-xl text-sm disabled:opacity-50">
                    <option value="">Não atribuído</option>
                    {team.map(member=><option key={member.id} value={member.id}>{member.first_name} {member.last_name}{member.staff?.job_title?' — '+member.staff.job_title:member.role==='admin'?' — Administrador':''}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500">Situação
                  <select value={conversation.status||'open'} onChange={e=>void updateCrm({status:e.target.value})} className={"pm-select-status mt-1.5 w-full min-h-11 px-3 rounded-xl text-sm "+(conversation.status==='resolved'?'pm-state-success':conversation.status==='pending'?'pm-state-pending':'pm-state-progress')}>
                    <option value="open">Aberta</option><option value="pending">Aguardando</option><option value="resolved">Resolvida</option>
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500">Prioridade
                  <select value={conversation.priority||'normal'} onChange={e=>void updateCrm({priority:e.target.value})} className={"pm-select-status mt-1.5 w-full min-h-11 px-3 rounded-xl text-sm "+(conversation.priority==='urgent'?'pm-state-danger':conversation.priority==='high'?'pm-state-pending':conversation.priority==='low'?'pm-state-neutral':'pm-state-progress')}>
                    <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500">Marcadores
                  <input key={conversation.id+(conversation.tags||[]).join(',')} defaultValue={(conversation.tags||[]).join(', ')} onBlur={e=>void updateCrm({tags:e.target.value.split(',').map(tag=>tag.trim()).filter(Boolean)})} placeholder="venda, vídeo, urgente" className="mt-1.5 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10 text-sm"/>
                </label>
                {(conversation.tags||[]).length>0&&<div className="flex flex-wrap gap-1.5">{conversation.tags?.map(tag=><span key={tag} className="pm-tag pm-tag-neutral">{tag}</span>)}</div>}
              </section>
            </div>
          </aside>}
        </div>
      )}
    </div>
  )
}
