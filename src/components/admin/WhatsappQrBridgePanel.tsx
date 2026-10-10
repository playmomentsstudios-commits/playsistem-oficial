import { useEffect,useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { settingsApi,type AppSettings } from '../../api/settings'

type BridgeState={
  requested_mode:'stopped'|'connect'|'disconnect'
  status:'offline'|'connecting'|'qr_ready'|'connected'|'error'|'logged_out'
  heartbeat_at:string|null
  qr_data_url:string|null
  qr_updated_at:string|null
  connected_phone:string|null
  last_error:string|null
}
const STATUS:Record<BridgeState['status'],string>={
  offline:'Ponte desligada',connecting:'Conectando dispositivo...',qr_ready:'Aguardando leitura do QR',
  connected:'Conectado',error:'Erro na conexão',logged_out:'Sessão desconectada',
}
export function WhatsappQrBridgePanel(){
  const toast=useToast()
  const [bridge,setBridge]=useState<BridgeState|null>(null)
  const [config,setConfig]=useState<AppSettings|null>(null)
  const [busy,setBusy]=useState(false)
  const [loadError,setLoadError]=useState('')
  const [now,setNow]=useState(Date.now())
  async function refresh(){
    const [status,configResult]=await Promise.all([
      supabase.from('whatsapp_bridge_state').select('requested_mode,status,heartbeat_at,qr_data_url,qr_updated_at,connected_phone,last_error').eq('id',true).maybeSingle(),
      settingsApi.appSettings()
    ])
    if(status.error)throw status.error
    setBridge(status.data as BridgeState|null)
    setConfig(configResult)
    setNow(Date.now())
    setLoadError('')
  }
  useEffect(()=>{
    let alive=true
    async function poll(){
      try{if(alive)await refresh()}
      catch(error:any){if(alive)setLoadError(error?.message||'Falha ao ler estado da ponte')}
    }
    void poll()
    const id=window.setInterval(()=>{void poll()},5000)
    return()=>{alive=false;window.clearInterval(id)}
  },[])
  const online=!!bridge?.heartbeat_at&&(now-new Date(bridge.heartbeat_at).getTime()<35000)
  const connected=online&&bridge?.status==='connected'
  const correctNumber=connected&&bridge.connected_phone===config?.wa_bridge_sender_phone
  const enabled=Boolean(config?.wa_bridge_auto_enabled)
  async function action(value:'connect'|'disconnect'|'enable'|'disable'){
    if(value==='enable'&&!window.confirm('Ativar até 10 tentativas automáticas por dia para o número de teste +55 64 98129-4186? A integração é NÃO OFICIAL e existe risco de bloqueio do WhatsApp comercial.'))return
    if(value==='disconnect'&&!window.confirm('Desconectar o dispositivo e revogar a sessão local do WhatsApp?'))return
    try{
      setBusy(true)
      const {data,error}=await supabase.rpc('wa_bridge_admin_control',{p_action:value})
      if(error)throw error
      toast(String(data||'Operação solicitada'),'success')
      await refresh()
    }catch(error:any){toast(error?.message||'Não foi possível executar a operação.','error')}
    finally{setBusy(false)}
  }
  return <section className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-white">Conexão do WhatsApp por QR Code</h2>
        <p className="mt-1 text-xs text-gray-400">Piloto local para o número comercial +55 64 98129-4186. É necessário manter o serviço Node ligado.</p>
      </div>
      <span className={'rounded-lg px-3 py-2 text-xs '+(connected?'bg-emerald-500/10 text-emerald-300':'bg-amber-500/10 text-amber-200')}>
        {connected?'● Conectado':online?'● '+STATUS[bridge!.status]:'● Serviço offline'}
      </span>
    </div>
    <p className="mt-3 text-xs text-amber-200">Conexão por biblioteca não oficial: risco de bloqueio do número. Sem tarifa por mensagem da biblioteca, mas computador e internet devem permanecer ativos.</p>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="min-h-[280px] rounded-2xl border border-white/10 bg-black/35 p-4 flex flex-col items-center justify-center gap-3">
        {online&&bridge?.status==='qr_ready'&&bridge.qr_data_url?
          <img src={bridge.qr_data_url} alt="QR Code temporário para vincular a Sagamente como dispositivo no WhatsApp Business" className="h-56 w-56 rounded-xl bg-white p-2" />:
          <div className="flex h-48 w-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 text-center">
            <span className="text-4xl">{connected?'✓':'▦'}</span>
            <span className="mt-3 px-3 text-xs text-gray-400">{connected?'WhatsApp vinculado':bridge?.requested_mode==='connect'?'Aguardando QR do serviço local':'Inicie o serviço e solicite a conexão'}</span>
          </div>}
        <p className="text-center text-[11px] text-gray-500">{bridge?.status==='qr_ready'&&online?'WhatsApp no celular → Dispositivos conectados → Conectar dispositivo':'O QR não é gerado pelo navegador; vem do serviço local conectado.'}</p>
      </div>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-black/30 p-3 border border-white/10">
            <p className="text-[11px] text-gray-500">Conta esperada</p><p className="mt-1 text-sm text-white">+55 64 98129-4186</p>
          </div>
          <div className="rounded-xl bg-black/30 p-3 border border-white/10">
            <p className="text-[11px] text-gray-500">Número vinculado</p><p className="mt-1 text-sm text-white">{connected?('+'+bridge?.connected_phone):'Nenhum'}</p>
          </div>
          <div className="rounded-xl bg-black/30 p-3 border border-white/10">
            <p className="text-[11px] text-gray-500">Tentativas diárias</p><p className="mt-1 text-sm text-white">{config?.wa_bridge_daily_limit??10} no máximo</p>
          </div>
          <div className="rounded-xl bg-black/30 p-3 border border-white/10">
            <p className="text-[11px] text-gray-500">Destino do piloto</p><p className="mt-1 text-sm text-white">{config?.wa_bridge_test_only?'Somente +'+config.wa_bridge_test_phone:'Clientes com aceite explícito'}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          <strong>Etapa 1:</strong> mantenha o serviço Node ligado e clique em “Solicitar conexão”. <strong>Etapa 2:</strong> escaneie o QR pelo WhatsApp Business. <strong>Etapa 3:</strong> confirme o número e clique em “Ativar piloto”. Só eventos novos entram na fila.
        </p>
        {bridge?.last_error&&<p className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{bridge.last_error}</p>}
        {loadError&&<p role="alert" className="text-xs text-red-300">{loadError}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>void action('connect')} className="min-h-10 rounded-xl bg-[#A65A2A] px-4 text-xs font-semibold text-white disabled:opacity-50">Solicitar conexão</button>
          {!enabled?<button disabled={busy||!correctNumber} onClick={()=>void action('enable')} className="min-h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-300 disabled:opacity-40">Ativar piloto</button>:
          <button disabled={busy} onClick={()=>void action('disable')} className="min-h-10 rounded-xl border border-amber-500/25 px-4 text-xs text-amber-300 disabled:opacity-50">Pausar envios</button>}
          <button disabled={busy} onClick={()=>void action('disconnect')} className="min-h-10 rounded-xl border border-white/15 px-4 text-xs text-gray-300 disabled:opacity-50">Desconectar aparelho</button>
        </div>
        <p className="text-[11px] text-gray-500">Envios automáticos: <strong className={enabled?'text-emerald-300':'text-gray-300'}>{enabled?'ATIVADOS (piloto)':'desativados'}</strong>. {online?'Serviço detectado.':'O QR real só aparece quando o serviço local estiver funcionando.'}</p>
      </div>
    </div>
  </section>
}
