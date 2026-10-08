import { FormEvent, useEffect, useState } from 'react'
import { autoattendantApi, AutoSolution } from '../../api/autoattendant'

const empty:Partial<AutoSolution>={name:'',kind:'service',keywords:[],response:'',question:'',route:'',crm_event:'service_interest',active:true,priority:100}

export function AdminAutoAttendant(){
 const [items,setItems]=useState<AutoSolution[]>([])
 const [form,setForm]=useState<Partial<AutoSolution>>(empty)
 const [keywords,setKeywords]=useState('')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const load=()=>autoattendantApi.list().then(setItems).catch(e=>setError(e.message))
 useEffect(()=>{void load()},[])
 const edit=(item:AutoSolution)=>{setForm(item);setKeywords(item.keywords.join(', '))}
 const reset=()=>{setForm(empty);setKeywords('')}
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError('');try{await autoattendantApi.save({...form,keywords:keywords.split(',')});reset();await load()}catch(err:any){setError(err.message)}finally{setSaving(false)}}
 return <div className="max-w-6xl mx-auto space-y-5">
  <div><p className="text-xs uppercase tracking-[.14em] text-[#ff6b7a] font-semibold">Comunicação</p><h1 className="text-2xl font-bold mt-1">Autoatendimento</h1><p className="text-sm text-gray-500 mt-1">Cadastre intenções, palavras-chave e a solução real que o atendimento deve recomendar.</p></div>
  {error&&<div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-300">{error}</div>}
  <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 grid md:grid-cols-2 gap-3">
   <label className="text-xs text-gray-400">Nome da solução<input required value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
   <label className="text-xs text-gray-400">Tipo<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as any})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"><option value="service">Serviço</option><option value="product">Produto</option><option value="academy">Academia</option><option value="support">Suporte</option></select></label>
   <label className="md:col-span-2 text-xs text-gray-400">Palavras-chave e sinônimos<input required value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="logo, logotipo, identidade visual, marca" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/><span className="text-[10px] text-gray-600">Separe por vírgulas.</span></label>
   <label className="md:col-span-2 text-xs text-gray-400">Resposta / solução<textarea required rows={3} value={form.response||''} onChange={e=>setForm({...form,response:e.target.value})} className="mt-1 w-full p-3 rounded-xl bg-black border border-white/10"/></label>
   <label className="text-xs text-gray-400">Pergunta de diagnóstico<input value={form.question||''} onChange={e=>setForm({...form,question:e.target.value})} placeholder="Ex.: É uma marca nova ou reformulação?" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
   <label className="text-xs text-gray-400">Destino interno<input value={form.route||''} onChange={e=>setForm({...form,route:e.target.value})} placeholder="/servicos/..." className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
   <div className="md:col-span-2 flex flex-wrap items-center gap-3"><label className="text-xs text-gray-400">Prioridade <input type="number" value={form.priority??100} onChange={e=>setForm({...form,priority:Number(e.target.value)})} className="ml-2 w-20 min-h-10 px-2 rounded-lg bg-black border border-white/10"/></label><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={form.active!==false} onChange={e=>setForm({...form,active:e.target.checked})}/> Ativa</label><button disabled={saving} className="ml-auto min-h-11 px-5 rounded-xl bg-[#A65A2A] font-semibold">{saving?'Salvando...':form.id?'Salvar alterações':'Adicionar solução'}</button>{form.id&&<button type="button" onClick={reset} className="min-h-11 px-4 text-xs text-gray-400">Cancelar</button>}</div>
  </form>
  <div className="grid gap-2">{items.map(item=><div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex gap-3 items-start"><div className="flex-1 min-w-0"><div className="flex gap-2 items-center"><b className="text-sm">{item.name}</b><span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500">{item.kind}</span>{!item.active&&<span className="text-[10px] text-gray-600">inativa</span>}</div><p className="text-xs text-gray-500 mt-1">{item.keywords.join(' · ')}</p><p className="text-xs text-gray-400 mt-2">{item.response}</p></div><button onClick={()=>edit(item)} className="text-xs text-[#ff6b7a]">Editar</button><button onClick={()=>{if(confirm('Excluir esta solução?'))void autoattendantApi.remove(item.id).then(load)}} className="text-xs text-gray-600">Excluir</button></div>)}</div>
 </div>
}
