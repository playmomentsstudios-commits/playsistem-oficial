import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { settingsApi, type AppSettings } from '../../api/settings'
import { useToast } from '../../contexts/ToastContext'

type WAState='ready_manual'|'missing_phone'|'historical'|'opened_manual'|'reported_sent'
type WARecord={
  id:string
  notification_id:string
  recipient_name:string
  destination_phone:string|null
  recipient_user_id:string
  event_type:string
  title:string
  message_body:string
  target_link:string|null
  status:WAState
  source:'live'|'historical'
  created_at:string
  opened_at:string|null
  reported_at:string|null
}
type Summary={
  prepared_today:number
  historical_total:number
  missing_phone_today:number
  opened_today:number
  reported_today:number
  provider_sent_today:number
  provider_delivered_today:number
  total_records:number
}
const EMPTY:Summary={prepared_today:0,historical_total:0,missing_phone_today:0,opened_today:0,
  reported_today:0,provider_sent_today:0,provider_delivered_today:0,total_records:0}
const RULES=[
  ['wa_prepare_project_status','Mudança de status ou prazo do projeto'],
  ['wa_prepare_task_status','Mudança de status de tarefa visível'],
  ['wa_prepare_stage_status','Mudança de etapa visível'],
  ['wa_prepare_file_updates','Arquivo liberado ao cliente'],
  ['wa_prepare_file_review','Arquivo enviado para revisão'],
  ['wa_prepare_priority_events','Alertas administrativos prioritários'],
] as const satisfies ReadonlyArray<readonly [keyof AppSettings,string]>
const STATUS:Record<WAState,{label:string;tone:string}>={
  ready_manual:{label:'Aguardando envio manual',tone:'text-amber-200 bg-amber-500/10'},
  missing_phone:{label:'Sem número válido',tone:'text-red-200 bg-red-500/10'},
  historical:{label:'Histórico · não enviado',tone:'text-gray-300 bg-white/5'},
  opened_manual:{label:'WhatsApp aberto',tone:'text-blue-200 bg-blue-500/10'},
  reported_sent:{label:'Envio declarado · não verificado',tone:'text-emerald-200 bg-emerald-500/10'},
}
const EVENT:Record<string,string>={
  project_status:'Status do projeto',project_updated:'Prazo do projeto',project_task:'Tarefa',
  project_stage:'Etapa',file_available:'Arquivo',file_received:'Arquivo',
  file_review_requested:'Revisão de arquivo',payment_confirmed_priority:'Pagamento confirmado',
  project_created_priority:'Novo projeto',project_completed_priority:'Projeto concluído'
}
function localDate(value:string){
  return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})
}
function safeUrl(path:string|null){
  if(!path?.startsWith('/')||path.startsWith('//'))return ''
  return window.location.origin+path
}
function exportCsv(rows:WARecord[]){
  const header=['Data','Evento','Destinatário','Telefone','Origem','Situação','Mensagem','Abertura manual','Declaração do operador']
  const esc=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"'
  const content=[header,...rows.map(r=>[localDate(r.created_at),EVENT[r.event_type]||r.event_type,
    r.recipient_name,r.destination_phone,r.source,STATUS[r.status].label,r.message_body,
    r.opened_at?localDate(r.opened_at):'',r.reported_at?localDate(r.reported_at):''])]
    .map(row=>row.map(esc).join(';')).join('\r\n')
  const blob=new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'})
  const href=URL.createObjectURL(blob)
  const link=document.createElement('a');link.href=href;link.download='sagamente-whatsapp-historico.csv'
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(href)
}
function Metric({label,value,description}:{label:string;value:number;description:string}){
  return <div className="rounded-2xl border border-white/10 bg-[#141416] p-4">
    <p className="text-xs text-gray-400">{label}</p>
    <p className="mt-2 text-3xl font-bold text-white tabular-nums">{value}</p>
    <p className="mt-2 text-[11px] text-gray-500">{description}</p>
  </div>
}
export function AdminWhatsappCenter(){
  const toast=useToast()
  const [settings,setSettings]=useState<AppSettings|null>(null)
  const [rows,setRows]=useState<WARecord[]>([])
  const [summary,setSummary]=useState<Summary>(EMPTY)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [view,setView]=useState<'history'|'settings'>('history')

  async function load(){
    setError('')
    try{
      const [cfg,list,daily]=await Promise.all([
        settingsApi.appSettings(),
        supabase.from('whatsapp_message_outbox')
          .select('id,notification_id,recipient_name,destination_phone,recipient_user_id,event_type,title,message_body,target_link,status,source,created_at,opened_at,reported_at')
          .order('created_at',{ascending:false}).limit(300),
        supabase.rpc('wa_daily_dashboard')
      ])
      if(list.error)throw list.error
      if(daily.error)throw daily.error
      setSettings(cfg)
      setRows((list.data||[]) as WARecord[])
      setSummary({...EMPTY,...(daily.data&&typeof daily.data==='object'?daily.data as Partial<Summary>:{})})
    }catch(err:any){
      setError(err?.message||'Não foi possível carregar a auditoria do WhatsApp.')
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  const filtered=useMemo(()=>rows.filter(r=>{
    if(filter!=='all'&&r.status!==filter)return false
    const s=search.trim().toLowerCase()
    return !s||[r.recipient_name,r.destination_phone,r.message_body,r.title,r.event_type].some(value=>(value||'').toLowerCase().includes(s))
  }),[rows,filter,search])

  async function save(){
    if(!settings)return
    try{
      setSaving(true)
      await settingsApi.saveAppSettings({
        priority_alerts_enabled:settings.priority_alerts_enabled,
        priority_daily_limit:settings.priority_daily_limit,
        priority_payment_confirmed:settings.priority_payment_confirmed,
        priority_project_created:settings.priority_project_created,
        priority_project_completed:settings.priority_project_completed,
        priority_whatsapp_phone:settings.priority_whatsapp_phone,
        wa_prepare_project_status:settings.wa_prepare_project_status,
        wa_prepare_task_status:settings.wa_prepare_task_status,
        wa_prepare_stage_status:settings.wa_prepare_stage_status,
        wa_prepare_file_updates:settings.wa_prepare_file_updates,
        wa_prepare_file_review:settings.wa_prepare_file_review,
        wa_prepare_priority_events:settings.wa_prepare_priority_events,
      })
      toast('Configurações salvas. O canal WhatsApp continua manual e gratuito.','success')
      await load()
    }catch(err:any){toast(err?.message||'Não foi possível salvar as configurações.','error')}
    finally{setSaving(false)}
  }
  async function mark(id:string,action:'opened'|'reported_sent'){
    const {error:rpcError}=await supabase.rpc('wa_mark_manual_action',{
      p_outbox_id:id,p_action:action,
    })
    if(rpcError)throw rpcError
    await load()
  }
  function openWhatsApp(item:WARecord){
    if(!item.destination_phone||item.status==='historical'||item.status==='missing_phone')return
    const destination=item.destination_phone.replace(/\D/g,'')
    if(!/^55\d{10,11}$/.test(destination)){
      toast('Número do destinatário inválido. Atualize o cadastro.','error')
      return
    }
    const prepared=item.message_body+(safeUrl(item.target_link)?'\n\nAcompanhar: '+safeUrl(item.target_link):'')
    const popup=window.open('https://wa.me/'+destination+'?text='+encodeURIComponent(prepared),'_blank')
    if(popup)popup.opener=null
    // "opened_manual" identifica apenas a ação de abrir. Não comprova envio.
    if(popup===null){
      toast('O navegador pode ter bloqueado a janela. Permita pop-ups para abrir o WhatsApp.','error')
      return
    }
    setBusy(item.id)
    void mark(item.id,'opened')
      .catch(err=>toast(err?.message||'Não foi possível registrar a abertura.','error'))
      .finally(()=>setBusy(null))
  }
  async function reportSent(item:WARecord){
    if(!window.confirm('Você confirma que enviou MANUALMENTE esta mensagem no WhatsApp? Isso é uma declaração do operador, não comprovação de entrega.'))return
    try{setBusy(item.id);await mark(item.id,'reported_sent');toast('Envio manual declarado. Entrega não verificada.','success')}
    catch(err:any){toast(err?.message||'Não foi possível registrar a declaração.','error')}
    finally{setBusy(null)}
  }
  return <div className="max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[.18em] text-[#A65A2A] font-semibold">Comunicação · Auditoria</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Central de WhatsApp</h1>
        <p className="mt-1 text-sm text-gray-400">Acompanhe cada destinatário, mensagem e ação manual com rastreabilidade.</p>
      </div>
      <button type="button" onClick={()=>{setLoading(true);void load()}} className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-xs">Atualizar dados</button>
    </header>

    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-4 text-sm text-amber-100">
      <strong>WhatsApp automático desativado · R$ 0,00 em tarifas.</strong>
      <p className="mt-1 text-xs text-amber-100/80">A Sagamente ainda não está conectada a um provedor oficial de envio e confirmação de entrega. Abrir o WhatsApp não significa enviar. Os indicadores de envio comprovado permanecem em zero.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Avisos preparados hoje" value={summary.prepared_today} description="Criados na fila manual, não enviados"/>
      <Metric label="Conversas abertas hoje" value={summary.opened_today} description="Abertura registrada, envio desconhecido"/>
      <Metric label="Enviados informados hoje" value={summary.reported_today} description="Declaração manual, sem verificação"/>
      <Metric label="Entregas confirmadas hoje" value={summary.provider_delivered_today} description="Sem provedor conectado · zero confirmado"/>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/10 bg-white/[.02] p-3 text-xs text-gray-400">
      <span><b className="text-white">{summary.missing_phone_today}</b> sem número hoje</span>
      <span><b className="text-white">{summary.historical_total}</b> eventos antigos identificados</span>
      <span><b className="text-white">{summary.total_records}</b> registros totais</span>
      <span><b className="text-white">{summary.provider_sent_today}</b> envios comprovados pela API hoje</span>
    </div>

    <div className="flex flex-wrap items-center gap-2 border-b border-white/10">
      <button onClick={()=>setView('history')} className={'px-4 py-3 text-sm '+(view==='history'?'border-b-2 border-[#A65A2A] text-white':'text-gray-500')}>Mensagens e destinatários</button>
      <button onClick={()=>setView('settings')} className={'px-4 py-3 text-sm '+(view==='settings'?'border-b-2 border-[#A65A2A] text-white':'text-gray-500')}>Configurações do canal</button>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-500/20 p-4 text-sm text-red-300">{error}</p>}
    {loading?<p className="py-12 text-center text-sm text-gray-400">Carregando a central...</p>:
      view==='settings'&&settings?<div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-[#141416] p-5">
          <h2 className="font-semibold">Canal e custo</h2>
          <p className="mt-1 text-xs text-gray-500">Modo disponível: manual. Envio automático e cobrança estão bloqueados.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-xs text-gray-400">WhatsApp administrativo (DDI + DDD + número)
              <input type="tel" inputMode="numeric" value={settings.priority_whatsapp_phone||''}
                onChange={e=>setSettings({...settings,priority_whatsapp_phone:e.target.value.replace(/\D/g,'').slice(0,13)})}
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"/>
            </label>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-gray-400">Modo de envio</p>
              <p className="mt-2 text-sm font-semibold text-white">Manual · WhatsApp por link</p>
              <p className="mt-1 text-[11px] text-gray-500">Não é um serviço de envio automático. Não gera custos de API.</p>
            </div>
            <label className="block text-xs text-gray-400">Teto diário de avisos administrativos prioritários (0–10)
              <input type="number" min={0} max={10} step={1} value={settings.priority_daily_limit}
                onChange={e=>setSettings({...settings,priority_daily_limit:Math.max(0,Math.min(10,Math.floor(Number(e.target.value)||0)))})}
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white"/>
              <span className="mt-1 block text-[11px] text-gray-500">Não é franquia gratuita de mensagens WhatsApp.</span>
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
              <span>Alertas prioritários internos habilitados</span>
              <input type="checkbox" checked={settings.priority_alerts_enabled} onChange={e=>setSettings({...settings,priority_alerts_enabled:e.target.checked})}/>
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141416] p-5">
          <h2 className="font-semibold">Eventos que entram na fila manual</h2>
          <p className="mt-1 text-xs text-gray-500">Desativar uma categoria impede novos preparos. Não altera notificações internas nem apaga histórico.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {RULES.map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-gray-300">
              <span>{label}</span>
              <input type="checkbox" checked={Boolean(settings[key])} onChange={e=>setSettings({...settings,[key]:e.target.checked})}/>
            </label>)}
          </div>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving} onClick={()=>void save()} className="min-h-11 rounded-xl bg-[#A65A2A] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Salvando...':'Salvar configurações'}</button>
          <Link to="/admin/configuracoes" className="text-xs text-gray-400 underline">Configurações gerais</Link>
        </div>
      </div>:
      view==='history'?<>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Pesquisar destinatário, número ou mensagem" value={search}
            onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar cliente, número ou conteúdo..."
            className="min-h-11 min-w-56 flex-1 rounded-xl border border-white/10 bg-[#141416] px-4 text-sm"/>
          <select aria-label="Filtrar situação" value={filter} onChange={e=>setFilter(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#141416] px-3 text-sm">
            <option value="all">Todas as situações</option>
            {(Object.keys(STATUS) as WAState[]).map(key=><option key={key} value={key}>{STATUS[key].label}</option>)}
          </select>
          <button onClick={()=>exportCsv(filtered)} disabled={!filtered.length} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs disabled:opacity-40">Exportar CSV</button>
        </div>
        <p className="text-[11px] text-gray-500">Exibindo {filtered.length} registros dentre os últimos 300. Indicadores incluem todos os registros do banco. Eventos históricos não representam tentativas de envio.</p>
        {!filtered.length?<div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-gray-500">Nenhuma mensagem corresponde aos filtros.</div>:
        <div className="space-y-3">
          {filtered.map(item=><article key={item.id} className="rounded-2xl border border-white/10 bg-[#141416] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-white">{item.recipient_name}</strong>
                  <span className={'rounded-md px-2 py-1 text-[10px] '+STATUS[item.status].tone}>{STATUS[item.status].label}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{item.destination_phone?('+'+item.destination_phone):'Telefone não cadastrado ou inválido'} · {EVENT[item.event_type]||item.event_type}</p>
                <p className="mt-1 text-[11px] text-gray-600">{localDate(item.created_at)} · {item.source==='historical'?'Importado para auditoria':'Gerado pelo sistema'}</p>
              </div>
              {item.status!=='historical'&&item.status!=='missing_phone'&&<div className="flex flex-wrap gap-2">
                <button onClick={()=>openWhatsApp(item)} disabled={busy===item.id} className="min-h-9 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-200 disabled:opacity-50">Abrir WhatsApp</button>
                {item.status==='opened_manual'&&<button onClick={()=>void reportSent(item)} disabled={busy===item.id} className="min-h-9 rounded-lg border border-white/15 px-3 text-xs text-gray-200 disabled:opacity-50">Informar envio manual</button>}
              </div>}
            </div>
            <details className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-gray-300">Ver mensagem preparada</summary>
              <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-400">{item.message_body}</p>
              {safeUrl(item.target_link)&&<p className="mt-2 break-all text-[11px] text-gray-600">{safeUrl(item.target_link)}</p>}
            </details>
            {(item.opened_at||item.reported_at)&&<p className="mt-2 text-[11px] text-gray-500">
              {item.opened_at?'Abertura registrada: '+localDate(item.opened_at):''}
              {item.reported_at?' · Declaração manual: '+localDate(item.reported_at):''}
            </p>}
          </article>)}
        </div>}
      </>:null}
    <p className="pb-5 text-[11px] text-gray-600">A Sagamente não consulta conversas externas no WhatsApp. Apenas um provedor oficial com confirmação de envio e webhooks poderá comprovar status de enviado, entregue e lido no futuro.</p>
  </div>
}
