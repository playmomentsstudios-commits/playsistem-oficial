import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {useToast} from '../../contexts/ToastContext'
type Key='project_started'|'stage_completed'|'review_available'|'adjustments_completed'|'final_delivery'|'new_message'
type Model={key:Key;title:string;icon:string;body:string;active:boolean}
const TEMPLATES:Model[]=[
 {key:'project_started',title:'Projeto iniciado',icon:'🚀',active:true,body:'*Seu projeto começou!*\n\nO projeto *{{project_name}}* já está em andamento.\n\n{{link}}'},
 {key:'stage_completed',title:'Etapa concluída',icon:'✅',active:true,body:'*Etapa concluída*\n\nA etapa *{{stage_name}}* do projeto *{{project_name}}* foi concluída.\n\n{{link}}'},
 {key:'review_available',title:'Revisão disponível',icon:'🔎',active:true,body:'*Revisão disponível*\n\nO material *{{material_name}}* do projeto *{{project_name}}* está pronto para sua análise.\n\n{{link}}'},
 {key:'adjustments_completed',title:'Ajustes concluídos',icon:'🛠️',active:true,body:'*Ajustes concluídos*\n\nUma nova versão do material *{{material_name}}* do projeto *{{project_name}}* está disponível.\n\n{{link}}'},
 {key:'final_delivery',title:'Entrega final',icon:'🎉',active:true,body:'*Entrega final disponível*\n\nConcluímos o projeto *{{project_name}}*. Os materiais finais estão disponíveis.\n\n{{link}}'},
 {key:'new_message',title:'Nova mensagem',icon:'💬',active:false,body:'*Nova mensagem no projeto*\n\nHá uma nova mensagem sobre *{{project_name}}*.\n\n{{link}}'},
]
const EXAMPLES:Record<string,string>={
 project_name:'Identidade visual da marca',stage_name:'Conceito visual',
 material_name:'Apresentação da proposta',customer_name:'Cliente',
 link:'🔗 Acompanhe:\nhttps://playsistem-oficial.playmomentsstudios.workers.dev/n/exemplo'
}
function validate(body:string){
 if(!body.trim()||body.length>1500)return 'Utilize de 1 a 1500 caracteres.'
 if((body.match(/\{\{link\}\}/g)||[]).length!==1||!/\{\{link\}\}\s*$/.test(body))
  return 'Mantenha {{link}} uma única vez, no final.'
 const unrecognized=body.replace(/\{\{(project_name|stage_name|material_name|customer_name|link)\}\}/g,'')
 if(unrecognized.includes('{{')||unrecognized.includes('}}'))
  return 'Existe uma variável desconhecida.'
 if(/https?:\/\//i.test(body))return 'Use {{link}} em vez de links externos.'
 return ''
}
const preview=(body:string)=>body.replace(/\{\{([^{}]*)\}\}/g,(_match,key:string)=>EXAMPLES[key]??_match)
export function WhatsappMessageTemplates(){
 const toast=useToast()
 const [selected,setSelected]=useState<Key>('project_started')
 const [stored,setStored]=useState<Partial<Record<Key,string>>>({})
 const [draft,setDraft]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const current=TEMPLATES.find(t=>t.key===selected)!
 const persisted=stored[selected]??current.body
 const changed=draft!==persisted
 const problem=useMemo(()=>validate(draft),[draft])
 useEffect(()=>{
  let mounted=true
  async function load(){
   try{
    const {data,error:queryError}=await supabase.from('wa_message_templates').select('template_key,body')
    if(queryError)throw queryError
    const values:Partial<Record<Key,string>>={}
    for(const item of data||[]){
     if(TEMPLATES.some(t=>t.key===item.template_key))values[item.template_key as Key]=item.body
    }
    if(TEMPLATES.some(t=>!values[t.key]))throw new Error('Os modelos não estão disponíveis. Verifique a migration do Supabase.')
    if(mounted){setStored(values);setDraft(values.project_started??TEMPLATES[0].body);setError('')}
   }catch(err:any){if(mounted)setError(err?.message||'Falha ao carregar modelos.')}
   finally{if(mounted)setLoading(false)}
  }
  void load()
  return()=>{mounted=false}
 },[])
 function choose(key:Key){
  if(key===selected)return
  if(changed&&!window.confirm('Descartar alterações não salvas?'))return
  setSelected(key)
  setDraft(stored[key]??TEMPLATES.find(t=>t.key===key)!.body)
 }
 async function save(){
  if(problem||!changed||saving)return
  try{
   setSaving(true)
   const {error:rpcError}=await supabase.rpc('wa_save_template',{p_key:selected,p_body:draft})
   if(rpcError)throw rpcError
   setStored(values=>({...values,[selected]:draft}))
   toast('Modelo salvo. Somente novos avisos usarão o texto atualizado.','success')
  }catch(err:any){toast(err?.message||'Erro ao salvar modelo.','error')}
  finally{setSaving(false)}
 }
 return <section className="space-y-4" aria-label="Editor de modelos WhatsApp">
  <header>
   <h2 className="text-base font-semibold text-white">Modelos de notificação</h2>
   <p className="mt-1 text-xs text-gray-400">Edite os textos que serão usados nos novos avisos. Prévia com dados de exemplo; links reais são gerados pelo sistema.</p>
  </header>
  {error&&<p role="alert" className="rounded-lg border border-amber-500/20 p-3 text-xs text-amber-200">{error}</p>}
  {loading?<p className="py-8 text-sm text-gray-400">Carregando modelos...</p>:
   <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
    <nav aria-label="Selecionar modelo" className="grid grid-cols-2 gap-2 self-start sm:grid-cols-3 lg:grid-cols-1">
     {TEMPLATES.map(item=><button type="button" key={item.key} disabled={!!error}
      onClick={()=>choose(item.key)} aria-current={selected===item.key?'true':undefined}
      className={'min-h-11 rounded-xl border px-3 py-2 text-left text-xs '+(selected===item.key?'border-[#A65A2A]/60 bg-[#A65A2A]/10 text-white':'border-white/10 bg-[#141416] text-gray-300')}>
      {item.icon} {item.title}</button>)}
    </nav>
    <div className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-[#141416] p-4">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-white">{current.title}</h3>
      <span className="text-xs text-gray-400">{changed?'Não salvo':'Salvo'} · {draft.length}/1500</span>
     </div>
     {!current.active&&<p className="rounded-lg border border-amber-500/20 p-3 text-xs text-amber-200">Modelo reservado: o evento de nova mensagem ainda não está ligado ao gerador automático do WhatsApp.</p>}
     <div className="grid gap-4 xl:grid-cols-2">
      <label className="block text-xs text-gray-300">Mensagem editável
       <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={11} maxLength={1500}
        disabled={saving||!!error}
        className="mt-2 min-h-[240px] w-full resize-y rounded-xl border border-white/10 bg-[#0d0d0f] p-3 font-mono text-xs leading-relaxed text-white outline-none focus:border-[#A65A2A]"/>
      </label>
      <div><p className="text-xs text-gray-300">Prévia</p>
       <div className="mt-2 min-h-[240px] whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-[#0d0d0f] p-3 text-sm leading-relaxed text-gray-200">{preview(draft)}</div>
      </div>
     </div>
     <details className="text-xs text-gray-400">
      <summary className="cursor-pointer py-1">Variáveis disponíveis</summary>
      <div className="mt-2 flex flex-wrap gap-2">{Object.keys(EXAMPLES).map(key=>
       <button key={key} type="button" disabled={!!error||key==='link'} onClick={()=>setDraft(v=>v.replace(/\{\{link\}\}\s*$/,'{{'+key+'}}\n\n{{link}}'))}
        className="rounded-lg border border-white/10 px-2 py-1 disabled:opacity-40">{'{{'+key+'}}'}</button>)}</div>
      <p className="mt-2">Mantenha {'{{link}}'} uma única vez no final. O link protegido sempre é inserido após os arquivos da mensagem.</p>
     </details>
     {problem&&<p role="alert" className="text-xs text-amber-200">{problem}</p>}
     <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>void save()} disabled={!changed||!!problem||saving||!!error}
       className="min-h-10 rounded-lg bg-[#A65A2A] px-4 text-xs font-semibold text-white disabled:opacity-40">{saving?'Salvando...':'Salvar modelo'}</button>
      <button type="button" disabled={saving||!!error} onClick={()=>{if(window.confirm('Restaurar o padrão para revisar antes de salvar?'))setDraft(current.body)}}
       className="min-h-10 rounded-lg border border-white/10 px-4 text-xs text-gray-300">Restaurar padrão</button>
      {changed&&<button type="button" onClick={()=>setDraft(persisted)} className="min-h-10 px-3 text-xs text-gray-400">Cancelar</button>}
     </div>
    </div>
   </div>}
 </section>
}
