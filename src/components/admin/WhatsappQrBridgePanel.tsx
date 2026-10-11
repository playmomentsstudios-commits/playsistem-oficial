import { useEffect,useRef,useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'
import { settingsApi,type AppSettings } from '../../api/settings'

type DeliveryMode='self_test'|'single_client'|'consented_clients'
type EligibleCustomer={user_id:string;customer_name:string;phone:string}
type BridgeState={
  requested_mode:'stopped'|'connect'|'disconnect'
  status:'offline'|'connecting'|'qr_ready'|'connected'|'error'|'logged_out'
  heartbeat_at:string|null
  qr_data_url:string|null
  qr_updated_at:string|null
  connected_phone:string|null
  last_error:string|null
  worker_capability:string|null
  worker_capability_at:string|null
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
  const [eligible,setEligible]=useState<EligibleCustomer[]>([])
  const [trialAccepted,setTrialAccepted]=useState(false)
  const [choiceMode,setChoiceMode]=useState<DeliveryMode>('self_test')
  const [choiceCustomer,setChoiceCustomer]=useState('')
  const initialized=useRef(false)
  async function refresh(){
    const [status,configResult,customers,trials]=await Promise.all([
      supabase.from('whatsapp_bridge_state').select('requested_mode,status,heartbeat_at,qr_data_url,qr_updated_at,connected_phone,last_error,worker_capability,worker_capability_at').eq('id',true).maybeSingle(),
      settingsApi.appSettings(),
      supabase.rpc('wa_bridge_eligible_customers'),
      supabase.from('whatsapp_bridge_attempts').select('id',{count:'exact',head:true}).eq('status','sent').eq('test_mode',false).in('ack_status',['delivered','read'])
    ])
    if(status.error)throw status.error
    if(customers.error)throw customers.error
    if(trials.error)throw trials.error
    setBridge(status.data as BridgeState|null)
    setConfig(configResult)
    setEligible((customers.data||[]) as EligibleCustomer[])
    setTrialAccepted((trials.count??0)>0)
    if(!initialized.current&&configResult){
      setChoiceMode(configResult.wa_bridge_delivery_mode||'self_test')
      setChoiceCustomer(configResult.wa_bridge_single_customer_id||'')
      initialized.current=true
    }
    setNow(Date.now())
    setLoadError('')
  }
  useEffect(()=>{
    const id=window.setInterval(()=>setNow(Date.now()),1000)
    return()=>window.clearInterval(id)
  },[])
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
  const heartbeatAgeMs=bridge?.heartbeat_at?now-Date.parse(bridge.heartbeat_at):null
  const online=heartbeatAgeMs!==null&&Number.isFinite(heartbeatAgeMs)&&heartbeatAgeMs>=0&&heartbeatAgeMs<35000
  const connected=online&&bridge?.status==='connected'
  const correctNumber=connected&&bridge.connected_phone===config?.wa_bridge_sender_phone
  const updatedBridge=Boolean(bridge?.worker_capability==='registered-jid-receipts-v1'&&bridge.worker_capability_at&&(now-new Date(bridge.worker_capability_at).getTime()<35000))
  const enabled=Boolean(config?.wa_bridge_auto_enabled)
  async function sendTest(){
    if(!window.confirm('Enviar UM teste automático exclusivamente para +55 64 98129-4186? Conta para o teto diário configurado na Central WhatsApp.'))return
    try{
      setBusy(true)
      const {error}=await supabase.rpc('wa_bridge_prepare_test')
      if(error)throw error
      toast('Teste preparado na fila. O serviço local tentará enviar em alguns segundos.','success')
    }catch(error:any){toast(error?.message||'Não foi possível preparar o teste.','error')}
    finally{setBusy(false)}
  }
  const mode=config?.wa_bridge_delivery_mode||'self_test'
  const target=eligible.find(person=>person.user_id===config?.wa_bridge_single_customer_id)
  const canUseRealTarget=mode!=='single_client'||Boolean(target)
  async function configureMode(){
    if(choiceMode==='single_client'&&!choiceCustomer){
      toast('Escolha primeiro um cliente que aceitou o WhatsApp.','error')
      return
    }
    if(choiceMode==='consented_clients'&&!trialAccepted){
      toast('É obrigatório testar com um cliente real primeiro.','error')
      return
    }
    if(!window.confirm('Salvar este modo de destinatários? Todos os envios automáticos serão pausados até uma nova ativação. Nenhuma mensagem antiga será reenviada.'))return
    try{
      setBusy(true)
      const {data,error}=await supabase.rpc('wa_bridge_set_delivery_mode',{
        p_mode:choiceMode,p_customer_id:choiceMode==='single_client'?choiceCustomer:null
      })
      if(error)throw error
      toast(String(data||'Modo selecionado. Envios pausados.'),'success')
      await refresh()
    }catch(error:any){toast(error?.message||'Não foi possível salvar o modo de entrega.','error')}
    finally{setBusy(false)}
  }
  async function action(value:'connect'|'disconnect'|'enable'|'disable'){
    if(value==='enable'){
      const desc=mode==='self_test'?'somente o número de teste +55 64 98129-4186':
        mode==='single_client'?('apenas '+(target?.customer_name||'cliente selecionado')+' no número +'+(target?.phone||'')):
        'TODOS os clientes que registraram consentimento válido'
      if(!window.confirm('ATENÇÃO: enviar automaticamente para '+desc+'? Até '+(config?.wa_bridge_daily_limit??30)+' tentativas por dia, além do controle de 2 minutos entre tentativas e 10 por hora, apenas para eventos NOVOS após ativar. Biblioteca NÃO OFICIAL com risco de bloqueio do número comercial.'))return
    }
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
    {bridge?.requested_mode==='connect'&&!online&&<p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
      {!bridge.heartbeat_at?'Nenhum heartbeat recebido.':!Number.isFinite(heartbeatAgeMs)?'Timestamp do heartbeat inválido.':heartbeatAgeMs<0?'Timestamp do heartbeat no futuro; estado tratado como offline.':`Heartbeat vencido há ${Math.floor(heartbeatAgeMs/1000)} s.`}
      {' '}Verifique se o processo Node está ativo, se o computador tem energia e rede e se o RPC do Supabase autentica. O painel não consegue distinguir essas causas sem diagnóstico da máquina.
    </p>}
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
            <p className="text-[11px] text-gray-500">Teto de tentativas por dia (ajustável na aba Configurações do canal)</p><p className="mt-1 text-sm text-white">{config?.wa_bridge_daily_limit??30} no máximo</p>
          </div>
          <div className="rounded-xl bg-black/30 p-3 border border-white/10">
            <p className="text-[11px] text-gray-500">Destino do piloto</p><p className="mt-1 text-sm text-white">{mode==='self_test'?'Somente +'+config?.wa_bridge_test_phone:mode==='single_client'?target?(target.customer_name+' · +'+target.phone):'Cliente selecionado sem aceite válido':'Todos os clientes com aceite válido'}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          <strong>1.</strong> Mantenha o serviço Node ligado. <strong>2.</strong> Conecte o dispositivo, se necessário. <strong>3.</strong> Selecione o destino abaixo e salve. <strong>4.</strong> Ative explicitamente os envios. Só eventos novos entram na fila.
        </p>
        {connected&&!updatedBridge&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Ponte Windows desatualizada. Para liberar envios a clientes, atualize index.mjs, phone-utils.mjs e receipt-tracker.mjs no computador e reinicie o serviço. A conexão atual não poderá disparar mensagens automaticamente.</p>}
        {bridge?.last_error&&<p className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{bridge.last_error}</p>}
        {loadError&&<p role="alert" className="text-xs text-red-300">{loadError}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>void action('connect')} className="min-h-10 rounded-xl bg-[#A65A2A] px-4 text-xs font-semibold text-white disabled:opacity-50">Solicitar conexão</button>
          {!enabled?<button disabled={busy||!correctNumber||!updatedBridge||!canUseRealTarget} onClick={()=>void action('enable')} className="min-h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-300 disabled:opacity-40">{mode==='self_test'?'Ativar piloto':mode==='single_client'?'Ativar para este cliente':'Ativar para clientes autorizados'}</button>:
          <button disabled={busy} onClick={()=>void action('disable')} className="min-h-10 rounded-xl border border-amber-500/25 px-4 text-xs text-amber-300 disabled:opacity-50">Pausar envios</button>}
          {enabled&&correctNumber&&mode==='self_test'&&<button disabled={busy} onClick={()=>void sendTest()} className="min-h-10 rounded-xl border border-[#A65A2A]/30 bg-[#A65A2A]/10 px-4 text-xs font-semibold text-[#DFA269] disabled:opacity-50">Enviar teste para meu WhatsApp</button>}
          <button disabled={busy} onClick={()=>void action('disconnect')} className="min-h-10 rounded-xl border border-white/15 px-4 text-xs text-gray-300 disabled:opacity-50">Desconectar aparelho</button>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Destinatários do envio automático</h3>
          <p className="text-xs text-gray-400">A mudança de modo nunca dispara mensagens: ela pausa o serviço até você ativá-lo novamente. Os clientes precisam aceitar os avisos em suas próprias contas, em Configurações.</p>
          <label className="block text-xs text-gray-400">Modo de entrega
            <select aria-label="Modo de entrega WhatsApp" value={choiceMode} onChange={e=>setChoiceMode(e.target.value as DeliveryMode)}
              className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#171719] text-sm px-3 text-white">
              <option value="self_test">Somente o meu WhatsApp (teste)</option>
              <option value="single_client">Apenas um cliente autorizado</option>
              <option value="consented_clients" disabled={!trialAccepted}>Todos os clientes que autorizaram {trialAccepted?'':'(requer primeiro teste individual)'}</option>
            </select>
          </label>
          {choiceMode==='single_client'&&<label className="block text-xs text-gray-400">Cliente com autorização registrada
            <select aria-label="Cliente autorizado para teste" value={choiceCustomer}
              onChange={e=>setChoiceCustomer(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#171719] px-3 text-sm text-white">
              <option value="">Selecione um cliente</option>
              {eligible.map(person=><option key={person.user_id} value={person.user_id}>{person.customer_name} · +{person.phone}</option>)}
            </select>
          </label>}
          {eligible.length===0&&<p className="rounded-lg border border-amber-500/15 p-3 text-xs text-amber-200">
            Nenhum cliente autorizou o WhatsApp ainda. Cada cliente precisa entrar no próprio portal, conferir o número do perfil e aceitar em Configurações → WhatsApp — Avisos dos meus projetos; não é possível forçar o aceite pelo administrador.
          </p>}
          {choiceMode==='consented_clients'&&<p className="text-xs text-amber-200">
            Etapa avançada: só habilite depois de confirmar com o primeiro cliente que a mensagem realmente chegou. As mensagens continuarão sujeitas ao limite diário.
          </p>}
          {mode==='single_client'&&!target&&<p className="text-xs text-red-300">O cliente selecionado perdeu a autorização ou mudou de número. O sistema impedirá novas tentativas reais para ele.</p>}
          <p className="text-[11px] text-gray-500">Modo salvo: {mode==='self_test'?'Teste no número da empresa':mode==='single_client'?'Somente um cliente':'Todos os clientes autorizados'}.
          {trialAccepted?' Entrega individual observada; confirme também diretamente com o destinatário antes de ampliar.':' Nenhuma entrega individual foi confirmada.'}</p>
          <button type="button" onClick={()=>void configureMode()}
            disabled={busy||enabled||(choiceMode==='single_client'&&!choiceCustomer)||(choiceMode==='consented_clients'&&!trialAccepted)}
            className="min-h-10 rounded-xl border border-[#A65A2A]/30 bg-[#A65A2A]/10 px-4 text-xs font-semibold text-[#DFA269] disabled:opacity-40">
            Salvar modo e manter envios pausados
          </button>
          {enabled&&<p className="text-xs text-amber-200">Para alterar destinatários, clique primeiro em “Pausar envios”.</p>}
        </div>
        <p className="text-[11px] text-gray-500">Envios automáticos: <strong className={enabled?'text-emerald-300':'text-gray-300'}>{enabled?'ATIVADOS ('+(mode==='self_test'?'piloto':'clientes reais')+')':'desativados'}</strong>. {online?'Serviço detectado.':'O QR real só aparece quando o serviço local estiver funcionando.'}</p>
      </div>
    </div>
  </section>
}
