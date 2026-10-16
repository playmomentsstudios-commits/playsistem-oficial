import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { buildSagaInternalPreview, sagaZonedParts, SAGA_ADMIN_SLOTS } from '../../lib/sagaInternalDigestPreview.mjs'
import type { SagaAdminEvent } from '../../lib/sagaInternalDigestPreview.mjs'

// INTERNAL ADMIN PREVIEW ONLY. No RPC, outbox write, worker, cron or WhatsApp calls.
type Snapshot = { at: string; day: string; events: SagaAdminEvent[] }
const card = 'rounded-2xl border border-white/10 bg-[#161618] p-4'

export function SagaDigestPreviewPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [slot, setSlot] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    setSnapshot(null)
    try {
      // Identity is checked against the authenticated session and the database.
      // The events table has an additional ADMIN-ONLY RLS policy.
      const { data:auth, error:authError } = await supabase.auth.getUser()
      if (authError || !auth.user) throw new Error('Sessão não autenticada.')
      const {data:profile,error:profileError} = await supabase.from('profiles')
        .select('id,role,status').eq('id',auth.user.id).maybeSingle()
      if (profileError || profile?.role !== 'admin' || profile?.status !== 'active')
        throw new Error('A prévia está disponível somente para administradores ativos.')
      const now = new Date()
      // A bounded read comfortably includes yesterday's 19h → today's 07h.
      const from = new Date(now.getTime() - 48*3600000).toISOString()
      const {data,error:eventsError} = await supabase.from('sagamente_assistant_events')
        .select('id,event_type,source_table,title,message,created_at')
        .gte('created_at',from).lte('created_at',now.toISOString())
        .order('created_at',{ascending:false}).limit(501)
      if (eventsError) throw eventsError
      // Refuse misleading partial previews rather than silently truncating.
      if (!Array.isArray(data) || data.length > 500)
        throw new Error('Muitos eventos para uma prévia completa. Use o histórico paginado.')
      setSnapshot({
        at:now.toISOString(),
        day:sagaZonedParts(now).day,
        events:data as SagaAdminEvent[],
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não consegui consultar a prévia.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {void refresh()},[refresh])

  const preview = snapshot
    ? buildSagaInternalPreview({events:snapshot.events,day:snapshot.day,slot,now:snapshot.at})
    : null
  return <section className="space-y-4" aria-label="Prévia interna dos resumos da Saga">
    <div className={card + ' space-y-2'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Prévia dos resumos</h2>
        <span className="rounded-lg border border-amber-500/30 px-3 py-1 text-xs text-amber-200">Simulação · sem envio</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">
        Consulta somente eventos internos visíveis a administradores. Nada é criado
        na fila ou enviado ao WhatsApp. As autorizações de clientes por evento
        ainda serão validadas separadamente no backend.
      </p>
      <div className="flex flex-wrap items-center gap-2" aria-label="Horário da prévia">
        {SAGA_ADMIN_SLOTS.map(hour =>
          <button key={hour} type="button" onClick={() => setSlot(hour)}
            aria-pressed={slot===hour}
            className={'min-h-11 rounded-xl px-4 text-sm ' + (slot===hour
              ? 'bg-[#A65A2A] font-semibold text-white' : 'border border-white/10 text-gray-300')}>
            {String(hour).padStart(2,'0')}h
          </button>)}
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="min-h-11 rounded-xl border border-white/10 px-3 text-sm text-gray-200 disabled:opacity-40">
          {loading ? 'Consultando…' : 'Atualizar prévia'}
        </button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-300">{error}</p>}
    {loading && <p role="status" className={card + ' text-sm text-gray-400'}>Consultando eventos internos com as permissões da conta…</p>}
    {!loading && preview && <div className={card + ' space-y-3'}>
      <p className="text-xs text-gray-400">Referência: {snapshot?.day} · America/Sao_Paulo</p>
      <h3 className="text-base font-semibold text-white">{preview.title}</h3>
      <p className="text-sm text-gray-400">{preview.count} evento{preview.count===1?'':'s'} neste período</p>
      {preview.lines.length===0
        ? <p className="text-sm text-gray-400">Não encontrei eventos neste período. Ainda não estou ativa para envios.</p>
        : <ul className="space-y-2">{preview.lines.map((line,index)=>
          <li key={index} className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-sm text-gray-200">{line}</li>
        )}</ul>}
      {preview.omitted>0 && <p className="text-xs text-amber-200">+{preview.omitted} eventos anteriores não exibidos nesta prévia.</p>}
      <p className="border-t border-white/10 pt-3 text-xs text-gray-500">
        Esta é uma visualização administrativa, não um comprovante de envio ou de entrega.
        Não enviei nenhuma mensagem.
      </p>
    </div>}
  </section>
}
