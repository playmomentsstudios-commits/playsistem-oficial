import {useCallback, useEffect, useState} from 'react'
import {supabase} from '../../lib/supabase'
import {Button} from '../../components/ui/Button'
import {useToast} from '../../contexts/ToastContext'

type Flow={id:string;name:string;event_key:string;enabled:boolean;title_template:string;message_template:string}
type Delivery={event_id:string;title:string;message_body:string;created_at:string;delivery_status:string;error_code:string|null;error_reason:string|null;provider_message_id:string|null}
const blank={name:'',title_template:'Check-in RKC',message_template:'',enabled:false}
const labels:Record<string,string>={queued:'Na fila',sending:'Enviando',sent_unconfirmed:'Enviado · aguardando confirmação',delivered:'Entregue',failed:'Falhou',cancelled:'Cancelado',draft:'Rascunho',approved:'Aprovado'}
const input='w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-orange-500/50'
export function AdminAutomations(){
 const toast=useToast()
 const [flows,setFlows]=useState<Flow[]>([])
 const [history,setHistory]=useState<Delivery[]>([])
 const [editing,setEditing]=useState<string|null>(null)
 const [form,setForm]=useState(blank)
 const [showForm,setShowForm]=useState(false)
 const [selected,setSelected]=useState('')
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  const [f,h]=await Promise.all([
   supabase.from('automation_flows').select('id,name,event_key,enabled,title_template,message_template').order('created_at'),
   supabase.from('automation_delivery_status').select('*').order('created_at',{ascending:false}).limit(50),
  ])
  if(f.error||h.error){setError(f.error?.message||h.error?.message||'Não foi possível carregar.');return}
  setFlows((f.data||[]) as Flow[]);setHistory((h.data||[]) as Delivery[]);setError('')
 },[])
 useEffect(()=>{void load();const timer=setInterval(()=>{void load()},15000);return()=>clearInterval(timer)},[load])
 const run=async(action:()=>Promise<void>)=>{
  setBusy(true)
  try{await action();await load()}catch(e){toast(e instanceof Error?e.message:'Não foi possível concluir.','error')}finally{setBusy(false)}
 }
 const save=async(id:string|null,value:typeof blank)=>{
  const {error}=await supabase.rpc('automation_admin_save',{p_id:id,p_name:value.name,p_title:value.title_template,p_template:value.message_template,p_enabled:value.enabled})
  if(error)throw error
 }
 const send=async(test:boolean)=>{
  const flow=flows.find(f=>f.id===selected)
  if(!flow)throw new Error('Selecione uma automação.')
  const {data,error}=await supabase.rpc('automation_admin_send',{p_flow_id:flow.id,p_message:message,p_test:test,p_request_key:`admin:${crypto.randomUUID()}`})
  if(error)throw error
  if(data.status==='failed')throw new Error(data.error_code||'Envio bloqueado.')
  toast(data.duplicate?'Teste já registrado. Consulte o histórico.':'Mensagem na fila. Aguarde a confirmação no histórico.','info')
 }
 return <div className="mx-auto max-w-5xl space-y-7 p-4 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <h1 className="text-xl font-semibold text-white">Automações e Notificações</h1>
   <Button size="sm" onClick={()=>{setEditing(null);setForm(blank);setShowForm(true)}}>Nova automação</Button>
  </header>
  {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
  <p className="text-sm text-[#9090a0]">Destinatário: Felipe Costa · +55 62 99324-1277</p>
  {showForm&&<form className="space-y-3 border-b border-white/10 pb-5" onSubmit={e=>{e.preventDefault();void run(async()=>{await save(editing,form);setShowForm(false)})}}>
   <label className="block space-y-1 text-sm text-[#9090a0]">Nome<input required maxLength={100} className={input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label className="block space-y-1 text-sm text-[#9090a0]">Título da mensagem<input required maxLength={120} className={input} value={form.title_template} onChange={e=>setForm({...form,title_template:e.target.value})}/></label>
   <label className="block space-y-1 text-sm text-[#9090a0]">Modelo<textarea rows={4} maxLength={4000} className={input} value={form.message_template} onChange={e=>setForm({...form,message_template:e.target.value})}/></label>
   <label className="flex items-center gap-2 text-sm text-[#9090a0]"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/>Ativa</label>
   <div className="flex gap-2"><Button size="sm" loading={busy}>Salvar</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setShowForm(false)}>Cancelar</Button></div>
  </form>}
  <div className="divide-y divide-white/10">
   {flows.map(flow=><div key={flow.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
    <div><p className="text-sm font-medium text-white">{flow.name}</p><p className={`mt-1 text-xs ${flow.enabled?'text-emerald-400':'text-[#9090a0]'}`}>{flow.enabled?'Ativa':'Pausada'}</p></div>
    <div className="flex gap-1">
     <Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setEditing(flow.id);setForm({name:flow.name,title_template:flow.title_template,message_template:flow.message_template,enabled:flow.enabled});setShowForm(true)}}>Editar</Button>
     <Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(()=>save(flow.id,{...flow,enabled:!flow.enabled}))}>{flow.enabled?'Pausar':'Ativar'}</Button>
    </div>
   </div>)}
   {!flows.length&&!error&&<p className="py-4 text-sm text-[#9090a0]">Nenhuma automação cadastrada.</p>}
  </div>
  <section className="space-y-3">
   <h2 className="text-sm font-medium text-white">Check-in manual</h2>
   <select aria-label="Automação" className={input} value={selected} onChange={e=>{setSelected(e.target.value);setMessage(flows.find(f=>f.id===e.target.value)?.message_template||'')}}>
    <option value="">Selecione uma automação</option>{flows.map(f=><option key={f.id} value={f.id}>{f.name}{!f.enabled?' · Pausada':''}</option>)}
   </select>
   <textarea aria-label="Mensagem do check-in" rows={4} maxLength={4000} className={input} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Editais, pendências, prazos e atividades…"/>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" loading={busy} disabled={!message.trim()||!flows.find(f=>f.id===selected)?.enabled} onClick={()=>void run(()=>send(false))}>Enviar check-in</Button>
    <Button size="sm" variant="ghost" disabled={busy||!selected} onClick={()=>void run(()=>send(true))}>Teste de integração</Button>
   </div>
  </section>
  <section className="space-y-3">
   <h2 className="text-sm font-medium text-white">Histórico</h2>
   <div className="divide-y divide-white/10">{history.map((item,i)=><details key={`${item.event_id}:${i}`} className="py-3">
    <summary className="cursor-pointer text-sm text-white"><span>{item.title}</span><span className={`ml-3 text-xs ${item.delivery_status==='delivered'?'text-emerald-400':item.delivery_status==='failed'?'text-red-400':'text-[#9090a0]'}`}>{labels[item.delivery_status]||item.delivery_status}</span><span className="ml-3 text-xs text-[#9090a0]">{new Date(item.created_at).toLocaleString('pt-BR')}</span></summary>
    <p className="mt-3 whitespace-pre-wrap text-sm text-[#9090a0]">{item.message_body}</p>
    {(item.error_code||item.error_reason)&&<p className="mt-2 text-sm text-red-400">{item.error_reason||item.error_code}</p>}
   </details>)}</div>
  </section>
 </div>
}
