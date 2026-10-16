import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SagaDigestPreviewPanel } from './SagaDigestPreviewPanel'
import { supabase } from '../../lib/supabase'

type View = 'events' | 'reports' | 'preview' | 'settings'
type EventRow = {
  id: string
  event_type: string
  event_key: string
  source_table: string
  title: string
  message: string
  status: 'pending' | 'internal_sent'
  created_at: string
  processed_at: string | null
  target_link: string
}
type Settings = {
  enabled: boolean
  internal_notifications: boolean
  whatsapp_notifications: boolean
  digest_times: string[]
  timezone: string
  updated_at: string
}

const PAGE_SIZE = 25
const card = 'rounded-2xl border border-white/10 bg-[#161618] p-4'
const field = 'min-h-11 rounded-xl border border-white/10 bg-[#101012] px-3 py-2 text-sm text-gray-100'
const names: Record<string, string> = {
  customer_registered: 'Cliente cadastrado',
  customer_status: 'Cadastro atualizado',
  task_created: 'Tarefa criada',
  task_status: 'Status de tarefa',
  checklist_updated: 'Checklist atualizado',
  project_stage_status: 'Etapa atualizada',
  academy_purchase_paid: 'Compra confirmada',
  academy_purchase_fulfilled: 'Compra concluída',
  academy_access_granted: 'Acesso à Academia',
  daily_digest: 'Relatório diário',
}
const validTime = /^([01]\d|2[0-3]):[0-5]\d$/

function dateTime(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function startOfDay(date: string): string {
  return new Date(date + 'T00:00:00-03:00').toISOString()
}
function startOfNextDay(date: string): string {
  return new Date(new Date(date + 'T00:00:00-03:00').getTime() + 86400000).toISOString()
}
function internalLink(value: string): string | null {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null
}
function describeError(value: unknown): string {
  return value instanceof Error ? value.message : 'Não consegui concluir esta operação.'
}

export function AdminSagaAssistant() {
  const [view, setView] = useState<View>('events')
  const [config, setConfig] = useState<Settings | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState('')
  const [internal, setInternal] = useState(false)
  const [times, setTimes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    setConfigError('')
    try {
      const { data, error } = await supabase.from('sagamente_assistant_settings')
        .select('enabled,internal_notifications,whatsapp_notifications,digest_times,timezone,updated_at')
        .eq('id', true).single()
      if (error) throw error
      const next = data as Settings
      setConfig(next)
      setInternal(next.internal_notifications)
      setTimes((next.digest_times || []).join(', '))
    } catch (cause) {
      setConfig(null)
      setConfigError(describeError(cause))
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from('sagamente_assistant_events')
        .select('id,event_key,event_type,source_table,title,message,status,created_at,processed_at,target_link', { count: 'exact' })
      if (view === 'reports') query = query.eq('event_type', 'daily_digest')
      else {
        query = query.neq('event_type', 'daily_digest')
        if (kind) query = query.eq('event_type', kind)
        if (status) query = query.eq('status', status)
      }
      if (from) query = query.gte('created_at', startOfDay(from))
      if (to) query = query.lt('created_at', startOfNextDay(to))
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (error) throw error
      setEvents((data || []) as EventRow[])
      setTotal(count ?? 0)
    } catch (cause) {
      setEvents([])
      setTotal(0)
      setError(describeError(cause))
    } finally {
      setLoading(false)
    }
  }, [view, page, kind, status, from, to])

  useEffect(() => { void loadConfig() }, [loadConfig])
  useEffect(() => { if (view === 'events' || view === 'reports') void loadEvents() }, [view, loadEvents])

  async function save() {
    if (!config) return
    setSaved('')
    setConfigError('')
    const hours = times.split(',').map(value => value.trim()).filter(Boolean)
    if (hours.length > 6 || hours.some(value => !validTime.test(value)) ||
        new Set(hours).size !== hours.length) {
      setConfigError('Use até seis horários únicos HH:MM, separados por vírgula.')
      return
    }
    setSaving(true)
    try {
      // As flags de ativação e WhatsApp são protegidas também por permissões SQL.
      const { error } = await supabase.from('sagamente_assistant_settings')
        .update({ internal_notifications: internal, digest_times: hours.sort(), updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
      await loadConfig()
      setSaved('Salvei suas preferências. Não ativei os envios.')
    } catch (cause) {
      setConfigError(describeError(cause))
    } finally {
      setSaving(false)
    }
  }
  function setTab(next: View) {
    setView(next)
    setPage(0)
    setError('')
  }
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1
  const last = Math.min(total, (page + 1) * PAGE_SIZE)
  return <div className="mx-auto max-w-5xl space-y-5 pb-10">
    <header className="space-y-1">
      <p className="text-xs font-semibold text-[#DFA269]">Play Sistem · Assistente operacional</p>
      <h1 className="text-2xl font-bold text-white">Saga</h1>
      <p className="text-sm text-gray-400">Sou a Saga, assistente deste sistema. Aqui acompanho eventos, resumos e preferências.</p>
    </header>
    <div className={card + ' flex flex-wrap items-center justify-between gap-3'}>
      <div>
        <p className="text-sm font-semibold text-white">Saga · Monitoramento operacional</p>
        <p className="mt-1 text-xs text-gray-400">Horários exibidos em Brasília (America/Sao_Paulo).</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg border border-white/10 px-3 py-2 text-gray-300">
          {configLoading ? 'Consultando estado…' : !config ? 'Estado indisponível' :
            config.enabled ? 'Agente ativo' : 'Agente desativado'}
        </span>
        <span className="rounded-lg border border-white/10 px-3 py-2 text-gray-400">
          {config?.whatsapp_notifications ? 'WhatsApp configurado' : 'Ainda não envio WhatsApp pela Saga'}
        </span>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="Áreas da Saga">
      {([['events','Eventos'],['reports','Relatórios diários'],['preview','Prévia dos resumos'],['settings','Configurações']] as const).map(([id, label]) =>
        <button key={id} type="button" aria-current={view === id ? 'page' : undefined}
          onClick={() => setTab(id)} className={'min-h-11 rounded-xl px-4 text-sm font-medium ' +
          (view === id ? 'bg-[#A65A2A] text-white' : 'border border-white/10 text-gray-300')}>
          {label}
        </button>)}
    </nav>
    {configError && <p role="alert" className="rounded-xl border border-red-500/20 p-3 text-sm text-red-300">{configError}</p>}

    {view === 'preview' ? <SagaDigestPreviewPanel /> : view === 'settings' ? <section className={card + ' space-y-5'}>
      <div>
        <h2 className="text-base font-semibold text-white">Preferências</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">As configurações abaixo não ativam o processador, os gatilhos ou envios externos.</p>
      </div>
      <label className="flex items-center gap-3 text-sm text-gray-200">
        <input type="checkbox" disabled={!config || saving} checked={internal}
          onChange={event => { setInternal(event.target.checked); setSaved('') }}/>
        Avisos internos (somente após homologação e ativação)
      </label>
      <label className="block space-y-2 text-sm text-gray-200">
        Horários para os resumos
        <input type="text" aria-label="Horários de resumos" disabled={!config || saving}
          className={field + ' block w-full'} value={times}
          onChange={event => { setTimes(event.target.value); setSaved('') }}
          placeholder="HH:MM, HH:MM"/>
        <span className="block text-xs text-gray-500">Até seis horários separados por vírgula, no fuso {config?.timezone || 'America/Sao_Paulo'}. Nenhum horário presumido.</span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span className="text-xs text-gray-500">Última alteração: {dateTime(config?.updated_at || null)}</span>
        <button type="button" disabled={!config || saving} onClick={() => void save()}
          className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-sm font-semibold text-white disabled:opacity-40">
          {saving ? 'Salvando…' : 'Salvar preferências'}
        </button>
      </div>
      {saved && <p role="status" className="text-xs text-emerald-300">{saved}</p>}
      <p className="text-xs leading-relaxed text-gray-500">Ativação e WhatsApp não podem ser alterados nesta tela. Não são executados disparos de teste.</p>
    </section> : <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {view === 'events' && <>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-gray-400">
            Tipo
            <select className={field} value={kind} onChange={event => { setKind(event.target.value); setPage(0) }}>
              <option value="">Todos os tipos</option>
              {Object.entries(names).filter(([id]) => id !== 'daily_digest')
                .map(([id,label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-gray-400">
            Situação
            <select className={field} value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>
              <option value="">Todas</option><option value="pending">Na fila</option>
              <option value="internal_sent">Aviso interno registrado</option>
            </select>
          </label>
        </>}
        <label className="flex min-w-[145px] flex-1 flex-col gap-1 text-xs text-gray-400">
          De
          <input aria-label="Data inicial" type="date" className={field}
            value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(0) }}/>
        </label>
        <label className="flex min-w-[145px] flex-1 flex-col gap-1 text-xs text-gray-400">
          Até
          <input aria-label="Data final" type="date" className={field}
            value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(0) }}/>
        </label>
        <button type="button" className={field} onClick={() => void loadEvents()} disabled={loading}>Atualizar</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-500/20 p-3 text-sm text-red-300">{error}</p>}
      <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
        <span>{total} registro{total === 1 ? '' : 's'} · {first}–{last}</span>
        <span>25 por página</span>
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {loading ? <p role="status" className="bg-[#161618] p-5 text-sm text-gray-400">Consultando registros…</p> :
          events.length === 0 ? <p className="bg-[#161618] p-5 text-sm text-gray-400">
            {view === 'reports' ? 'Nenhum relatório registrado para este período.' : 'Nenhum evento registrado para os filtros selecionados.'}
          </p> : events.map(event => <details key={event.id} className="bg-[#161618] p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#DFA269]">{names[event.event_type] || event.event_type}</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {event.event_type === 'daily_digest' ? 'Saga | Relatório diário' : event.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{dateTime(event.created_at)}</p>
                </div>
                <span className={'rounded-lg px-2 py-1 text-xs ' +
                  (event.status === 'internal_sent' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200')}>
                  {event.status === 'internal_sent' ? 'Aviso interno registrado' : 'Na fila'}
                </span>
              </div>
            </summary>
            <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{event.message}</p>
              <p className="text-xs text-gray-500">Origem: {event.source_table} · Processado: {dateTime(event.processed_at)}</p>
              <p className="break-all text-xs text-gray-500">Identificador: {event.id}</p>
              {internalLink(event.target_link) && <Link to={internalLink(event.target_link)!}
                className="inline-block text-xs text-[#DFA269] hover:underline">Abrir na plataforma ↗</Link>}
            </div>
          </details>)
        }
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <span>Página {page + 1} de {pageCount}</span>
        <div className="flex gap-2">
          <button type="button" className={field + ' disabled:opacity-40'}
            disabled={loading || page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Anterior</button>
          <button type="button" className={field + ' disabled:opacity-40'}
            disabled={loading || (page + 1) * PAGE_SIZE >= total} onClick={() => setPage(value => value + 1)}>Próxima</button>
        </div>
      </div>
    </section>}
  </div>
}
