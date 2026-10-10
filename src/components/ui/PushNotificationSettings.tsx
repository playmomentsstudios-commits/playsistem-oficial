import { useEffect,useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_PUSH_CATEGORIES,pushNotificationApi,supportStatus,type PushCategories } from '../../api/pushNotifications'
import { useAuth } from '../../contexts/AuthContext'

const sections:{key:keyof PushCategories;name:string;hint:string}[]=[
  {key:'messages',name:'Mensagens',hint:'Mensagens recebidas de clientes e equipe'},
  {key:'projects',name:'Projetos e tarefas',hint:'Andamento e entregas de projetos'},
  {key:'files',name:'Arquivos e aprovações',hint:'Novas artes e arquivos liberados'},
  {key:'commercial',name:'Orçamentos e pagamentos',hint:'Novidades comerciais e cobranças'},
  {key:'deadlines',name:'Prazos',hint:'Lembretes de datas e vencimentos'},
]
export function PushNotificationSettings({compact=false}:{compact?:boolean}){
  const {user}=useAuth()
  const [open,setOpen]=useState(false)
  const [enabled,setEnabled]=useState(false)
  const [categories,setCategories]=useState<PushCategories>(DEFAULT_PUSH_CATEGORIES)
  const [permission,setPermission]=useState('default')
  const [supported,setSupported]=useState(true)
  const [installed,setInstalled]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')
  const [devices,setDevices]=useState(0)
  const load=async()=>{
    const support=supportStatus()
    setPermission(support.permission)
    setSupported(support.supported)
    setInstalled(support.installed)
    if(!support.supported)return
    try{
      const data=await pushNotificationApi.status()
      setEnabled(data.enabled)
      setDevices(data.devices)
      setCategories(data.categories||DEFAULT_PUSH_CATEGORIES)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar avisos.')}
  }
  useEffect(()=>{if(open&&user?.id)void load()},[open,user?.id])
  const run=async(task:()=>Promise<unknown>,success:string)=>{
    setBusy(true);setError('');setFeedback('')
    try{await task();setFeedback(success);await load()}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar os avisos.')}
    finally{setBusy(false)}
  }
  const updateCategory=async(key:keyof PushCategories,value:boolean)=>{
    const next={...categories,[key]:value}
    setCategories(next)
    if(enabled)await run(()=>pushNotificationApi.updatePreferences(next),'Preferências deste dispositivo atualizadas.')
  }
  return <>
    <button type="button" onClick={()=>{setError('');setFeedback('');setOpen(true)}}
      className={compact
        ? 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold hover:bg-white/[.06]'
        : 'pm-compact-tap inline-flex gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 text-xs font-semibold hover:bg-white/[.08]'}>
      <span aria-hidden="true">🔔</span>{compact?'Notificações Push':'Configurar avisos no celular e computador'}
    </button>
    {open&&createPortal(<div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
      <section role="dialog" aria-modal="true" aria-labelledby="push-settings-title" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#141416] p-4 text-white shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="push-settings-title" className="text-base font-bold text-white">Avisos no dispositivo</h2>
            <p className="mt-1 text-xs text-gray-400">Receba novidades mesmo sem abrir o Sagamente.</p>
          </div>
          <button type="button" disabled={busy} onClick={()=>setOpen(false)} aria-label="Fechar configuração de notificações" className="min-h-10 min-w-10 rounded-lg border border-white/10 text-gray-200">✕</button>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <p className="text-sm font-semibold">{enabled?'Avisos ativados':'Avisos desativados'}</p>
            <p className="mt-1 text-[11px] text-gray-400">{enabled?devices+' dispositivo(s) ativo(s) na conta':'Ative neste aparelho com sua autorização'}</p>
          </div>
          <span className={'h-2.5 w-2.5 rounded-full '+(enabled?'bg-emerald-400':'bg-gray-500')}/>
        </div>
        {!supported&&<p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">Este navegador não oferece Push. No iPhone, use Compartilhar → Adicionar à Tela de Início e abra o aplicativo pelo ícone. Requer iOS 16.4 ou superior.</p>}
        {supported&&!installed&&<p className="mt-3 text-xs text-gray-400">Dica: instale o Sagamente para uma experiência de aplicativo. No iPhone, a instalação na Tela de Início é necessária.</p>}
        {permission==='denied'&&<p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">As notificações estão bloqueadas pelo navegador ou sistema. Altere a permissão nas configurações do dispositivo e abra esta tela novamente.</p>}
        <div className="mt-3 space-y-1.5">
          <p className="mb-2 text-xs font-semibold text-gray-300">O que deseja receber?</p>
          {sections.map(item=><label key={item.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[.08] bg-white/[.025] p-2.5">
            <span className="min-w-0"><span className="block text-xs font-semibold text-white">{item.name}</span><span className="block text-[11px] text-gray-400">{item.hint}</span></span>
            <input type="checkbox" checked={categories[item.key]} disabled={busy}
              onChange={e=>void updateCategory(item.key,e.target.checked)} className="h-4 w-4 shrink-0 accent-[#A65A2A]"/>
          </label>)}
        </div>
        {error&&<p role="alert" className="mt-3 rounded-lg border border-red-500/30 p-3 text-xs text-red-300">{error}</p>}
        {feedback&&<p role="status" className="mt-3 text-xs text-emerald-300">{feedback}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!enabled?
            <button type="button" disabled={busy||!supported||permission==='denied'}
              onClick={()=>void run(()=>pushNotificationApi.enable(categories),'Notificações ativadas neste dispositivo.')}
              className="min-h-11 flex-1 rounded-lg bg-[#A65A2A] px-3 text-xs font-bold text-white disabled:opacity-40">{busy?'Ativando...':'Ativar notificações'}</button>
            : <>
              <button type="button" disabled={busy} onClick={()=>void run(()=>pushNotificationApi.sendTest(),'Aviso de teste enviado à fila.')}
                className="min-h-11 flex-1 rounded-lg bg-[#A65A2A] px-3 text-xs font-bold text-white disabled:opacity-40">{busy?'Enviando...':'Enviar teste'}</button>
              <button type="button" disabled={busy} onClick={()=>void run(()=>pushNotificationApi.disable(),'Avisos desativados neste dispositivo.')}
                className="min-h-11 rounded-lg border border-white/15 px-3 text-xs text-gray-200 disabled:opacity-40">Desativar</button>
            </>}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-gray-500">As preferências são específicas deste dispositivo. Os avisos dependem das permissões do sistema e de conexão com a internet. Para segurança, exibimos mensagens resumidas na tela bloqueada.</p>
      </section>
    </div>,document.body)}
  </>
}
