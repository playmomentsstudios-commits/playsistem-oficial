import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'

type Field={
  id:string;label:string;type?:string;required?:boolean;options?:string[];
  maxLength?:number;showWhen?:{field:string;in:string[]}
}
type Section={id:string;title:string;fields:Field[]}
type Snapshot={name?:string;sections:Section[];defaultStages?:string[];drive?:Record<string,unknown>}
type Instance={project_id:string;template_slug:string;snapshot:Snapshot;answers:Record<string,unknown>;review_states:Record<string,string>}
const inputStyle='w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50'
const actionStyle='rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40'

function visible(field:Field,answers:Record<string,unknown>){
  if(!field.showWhen)return true
  return field.showWhen.in.includes(String(answers[field.showWhen.field]||''))
}
function filled(field:Field,value:unknown){
  if(field.type==='checkbox')return value===true
  return String(value??'').trim().length>0
}
function fieldValue(value:unknown){return typeof value==='string'?value:String(value??'')}
function safeDate(value:unknown){return fieldValue(value).slice(0,16)}

export function ProjectEditalForm({projectId}:{projectId:string}){
  const [instance,setInstance]=useState<Instance|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [saving,setSaving]=useState(false)
  const [sectionId,setSectionId]=useState('')
  const [newLabel,setNewLabel]=useState('')
  const [newType,setNewType]=useState('long_text')

  useEffect(()=>{
    let active=true
    void portalApi.projectFormInstance(projectId).then((data:Instance|null)=>{
      if(active){setInstance(data);setLoading(false)}
    }).catch((e:Error)=>{if(active){setError(e.message);setLoading(false)}})
    return()=>{active=false}
  },[projectId])

  const answers=instance?.answers||{}
  const fields=useMemo(()=>instance?.snapshot?.sections?.flatMap(s=>s.fields)||[],[instance])
  const shown=fields.filter(field=>visible(field,answers))
  const missing=shown.filter(field=>field.required&&!filled(field,answers[field.id]))
  const done=shown.filter(field=>filled(field,answers[field.id])).length

  const patch=(fn:(old:Instance)=>Instance)=>{
    setInstance(prev=>prev?fn(prev):prev)
    setNotice('')
  }
  const updateAnswer=(fieldId:string,value:unknown)=>patch(old=>({
    ...old,answers:{...old.answers,[fieldId]:value},
    review_states:{...old.review_states,[fieldId]:'rascunho'},
  }))
  const markReviewed=(fieldId:string)=>patch(old=>({...old,review_states:{...old.review_states,[fieldId]:'revisado'}}))

  async function save(){
    if(!instance)return
    const submitted=instance.answers.status_externo==='enviado'
    if(submitted&&(!filled({id:'protocolo',label:'Protocolo'},instance.answers.protocolo)||!filled({id:'data_envio',label:'Data do envio'},instance.answers.data_envio))){
      setError('Para marcar como enviado, informe a data do envio e o protocolo. Isso não envia a inscrição ao site externo.')
      return
    }
    setSaving(true);setError('')
    try{
      const saved=await portalApi.saveProjectFormInstance(projectId,instance.snapshot,instance.answers,instance.review_states)
      setInstance(saved)
      setNotice('Respostas salvas no Play Sistem. Nenhuma inscrição externa foi enviada.')
    }catch(e:any){setError(e?.message||'Não foi possível salvar o formulário.')}
    finally{setSaving(false)}
  }
  function moveField(sectionId:string,index:number,delta:number){
    patch(old=>({...old,snapshot:{...old.snapshot,sections:old.snapshot.sections.map(s=>{
      if(s.id!==sectionId)return s
      const arr=[...s.fields],dest=index+delta
      if(dest<0||dest>=arr.length)return s
      ;[arr[index],arr[dest]]=[arr[dest],arr[index]]
      return {...s,fields:arr}
    })}}))
  }
  function removeField(sectionId:string,fieldId:string){
    if(!window.confirm('Remover esta pergunta do formulário do projeto? A resposta permanece no histórico local até salvar.'))return
    patch(old=>({...old,snapshot:{...old.snapshot,sections:old.snapshot.sections.map(s=>s.id===sectionId?{...s,fields:s.fields.filter(f=>f.id!==fieldId)}:s)}}))
  }
  function addField(){
    if(!newLabel.trim()||!instance)return
    const section=instance.snapshot.sections.find(s=>s.id===sectionId)||instance.snapshot.sections[0]
    if(!section)return
    const id='custom_'+Date.now()
    patch(old=>({...old,snapshot:{...old.snapshot,sections:old.snapshot.sections.map(s=>s.id!==section.id?s:{...s,fields:[...s.fields,{id,label:newLabel.trim(),type:newType,required:false}]})}}))
    setNewLabel('')
  }
  function exportText(){
    if(!instance)return
    const lines=[instance.snapshot.name||'Editais','','Projeto interno — formulário de candidatura']
    for(const section of instance.snapshot.sections){
      lines.push('',section.title)
      for(const field of section.fields){
        if(!visible(field,answers))continue
        lines.push(field.label+'\n'+(field.type==='checkbox'?(answers[field.id]===true?'Sim':'Não'):fieldValue(answers[field.id]))+'\n')
      }
    }
    const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download='formulario-edital-'+projectId.slice(0,8)+'.txt';a.click()
    URL.revokeObjectURL(url)
  }
  if(loading)return <p className="text-sm text-gray-400">Carregando modelo de edital...</p>
  if(!instance)return error?<p className="text-sm text-red-300">Formulário indisponível: {error}</p>:null

  return <section className="mt-4 rounded-2xl border border-white/10 bg-[#141416] p-4 md:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs uppercase tracking-wider text-orange-300">Modelo de categoria</p>
        <h2 className="text-lg font-semibold">{instance.snapshot.name||'Editais'} · Formulário</h2>
        <p className="text-xs text-gray-400">Rascunho interno. Adapte campos e etapas a cada edital; não há envio automático.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={actionStyle} onClick={exportText}>Exportar respostas</button>
        <button type="button" onClick={()=>void save()} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{saving?'Salvando...':'Salvar formulário'}</button>
      </div>
    </div>
    <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
      <div className="flex justify-between gap-2"><span>Campos preenchidos: {done} de {shown.length}</span><span className={missing.length?'text-amber-300':'text-emerald-300'}>{missing.length} obrigatório(s) pendente(s)</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{width:((done/Math.max(shown.length,1))*100)+'%'}}/></div>
    </div>
    {error&&<p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
    {notice&&<p role="status" className="mb-3 text-sm text-emerald-300">{notice}</p>}
    <div className="space-y-3">
    {instance.snapshot.sections.map(section=><details key={section.id} className="rounded-xl border border-white/10 bg-black/20" open={section.id==='identificacao'||undefined}>
      <summary className="cursor-pointer px-4 py-3 font-semibold">{section.title} <span className="text-xs font-normal text-gray-500">({section.fields.filter(f=>visible(f,answers)&&filled(f,answers[f.id])).length}/{section.fields.filter(f=>visible(f,answers)).length})</span></summary>
      <div className="space-y-4 border-t border-white/10 p-4">
      {section.fields.map((field,index)=>{
        if(!visible(field,answers))return null
        const value=answers[field.id]
        const isReviewed=instance.review_states?.[field.id]==='revisado'
        return <div key={field.id} className="rounded-lg border border-white/[.05] p-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label htmlFor={'edital-'+field.id} className="flex-1 text-sm font-medium">{field.label}{field.required&&<span className="ml-1 text-orange-300">*</span>}</label>
            {isReviewed&&<span className="text-xs text-emerald-300">Revisado</span>}
            <button type="button" className={actionStyle} title="Copiar resposta" onClick={()=>void navigator.clipboard.writeText(fieldValue(value))}>Copiar</button>
            <button type="button" className={actionStyle} onClick={()=>markReviewed(field.id)}>Revisado</button>
            <button type="button" className={actionStyle} onClick={()=>moveField(section.id,index,-1)} disabled={index===0}>↑</button>
            <button type="button" className={actionStyle} onClick={()=>moveField(section.id,index,1)} disabled={index===section.fields.length-1}>↓</button>
            {!field.required&&<button type="button" className={actionStyle+' text-red-300'} onClick={()=>removeField(section.id,field.id)}>Remover</button>}
          </div>
          {field.type==='checkbox'?<label className="flex items-center gap-2 text-sm text-gray-300"><input id={'edital-'+field.id} type="checkbox" checked={value===true} onChange={e=>updateAnswer(field.id,e.target.checked)}/>Confirmado</label>
          :field.type==='select'?<select id={'edital-'+field.id} className={inputStyle} value={fieldValue(value)} onChange={e=>updateAnswer(field.id,e.target.value)}><option value="">Selecione...</option>{(field.options||[]).map(x=><option value={x} key={x}>{x.split('_').join(' ')}</option>)}</select>
          :field.type==='long_text'?<textarea id={'edital-'+field.id} rows={field.id==='links'?4:3} maxLength={field.maxLength} className={inputStyle} value={fieldValue(value)} onChange={e=>updateAnswer(field.id,e.target.value)} placeholder={field.id==='links'?'Cole um link por linha':'Escreva sua resposta aqui'}/>
          :<input id={'edital-'+field.id} className={inputStyle} type={field.type==='date'?'date':field.type==='datetime'?'datetime-local':field.type==='url'?'url':'text'} maxLength={field.maxLength} value={field.type==='datetime'?safeDate(value):fieldValue(value)} onChange={e=>updateAnswer(field.id,e.target.value)} />}
          {field.maxLength&&<p className="mt-1 text-right text-xs text-gray-500">{fieldValue(value).length}/{field.maxLength} caracteres</p>}
          {['autodeclaracao','documentos_pessoais','contrato','carta_representacao','declaracao_maioria'].includes(field.id)&&<p className="mt-1 text-xs text-amber-200/80">Não cole dados pessoais sensíveis neste campo. Referencie o arquivo privado já anexado ao projeto.</p>}
        </div>
      })}
      </div>
    </details>)}
    </div>
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-3">
      <h3 className="mb-2 text-sm font-semibold">Adicionar pergunta personalizada</h3>
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_130px_auto]">
        <input className={inputStyle} value={newLabel} placeholder="Título da pergunta" onChange={e=>setNewLabel(e.target.value)}/>
        <select value={sectionId||instance.snapshot.sections[0]?.id||''} className={inputStyle} onChange={e=>setSectionId(e.target.value)}>{instance.snapshot.sections.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select>
        <select value={newType} className={inputStyle} onChange={e=>setNewType(e.target.value)}><option value="long_text">Texto longo</option><option value="text">Texto</option><option value="url">Link</option><option value="date">Data</option><option value="checkbox">Sim/Não</option></select>
        <button type="button" className={actionStyle} onClick={addField}>Adicionar</button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Perguntas extras ficam somente neste projeto. Campos originais obrigatórios são preservados.</p>
    </div>
    <p className="mt-4 text-xs text-gray-500">Anexe os arquivos na área Arquivos ou nas etapas do projeto. Este formulário salva referências, respostas e revisão.</p>
  </section>
}
