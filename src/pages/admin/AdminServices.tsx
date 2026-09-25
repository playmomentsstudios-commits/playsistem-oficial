import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { rotulo,statusPublicacao,tipoPrecoServico } from '../../lib/labels.ptBR'
import { Button } from '../../components/ui/Button'

type ServiceForm={
  name:string
  slug:string
  short_description:string
  description:string
  category:string
  price_type:'fixed'|'starting_at'|'quote'
  price:string
  starting_price:string
  active:boolean
  featured:boolean
  status:'draft'|'published'|'archived'
}

const emptyForm:ServiceForm={
  name:'',
  slug:'',
  short_description:'',
  description:'',
  category:'',
  price_type:'quote',
  price:'',
  starting_price:'',
  active:true,
  featured:false,
  status:'draft',
}

function slugify(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}

function cents(value:string){
  if(!value.trim())return null
  const normalized=value.replace(/\./g,'').replace(',','.')
  const number=Number(normalized)
  return Number.isFinite(number)?Math.round(number*100):null
}

function moneyInput(value:number|null){
  return value===null||value===undefined?'':(value/100).toFixed(2).replace('.',',')
}

export function AdminServices(){
  const {user}=useAuth()
  const toast=useToast()
  const [rows,setRows]=useState<any[]>([])
  const [form,setForm]=useState<ServiceForm>(emptyForm)
  const [editing,setEditing]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)
  const [showForm,setShowForm]=useState(false)

  const load=()=>portalApi.services(true).then(setRows)
  useEffect(()=>{void load()},[])

  function openNew(){
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(service:any){
    setEditing(service.id)
    setForm({
      name:service.name||'',
      slug:service.slug||'',
      short_description:service.short_description||'',
      description:service.description||'',
      category:service.category||'',
      price_type:service.price_type||'quote',
      price:moneyInput(service.price),
      starting_price:moneyInput(service.starting_price),
      active:!!service.active,
      featured:!!service.featured,
      status:service.status||'draft',
    })
    setShowForm(true)
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    if(!form.name.trim())return
    try{
      setSaving(true)
      const payload={
        name:form.name.trim(),
        slug:form.slug.trim()||slugify(form.name),
        short_description:form.short_description.trim()||null,
        description:form.description.trim(),
        category:form.category.trim()||null,
        price_type:form.price_type,
        price:form.price_type==='fixed'?cents(form.price):null,
        starting_price:form.price_type==='starting_at'?cents(form.starting_price):null,
        active:form.active,
        featured:form.featured,
        status:form.status,
        ...(editing?{}:{created_by:user?.id||null}),
      }
      await portalApi.saveService(payload,editing||undefined)
      toast(editing?'Serviço atualizado.':'Serviço criado.','success')
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      await load()
    }catch(e:any){
      toast(e.message,'error')
    }finally{
      setSaving(false)
    }
  }

  return <div>
    <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Serviços</h1>
        <p className="text-sm text-gray-500">Cadastre, publique e gerencie os serviços da Play Moments</p>
      </div>
      <Button onClick={openNew}>Novo serviço</Button>
    </div>

    {showForm&&<form onSubmit={save} className="p-5 rounded-2xl bg-[#141416] border border-white/10 mb-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <input value={form.name} onChange={e=>setForm({...form,name:e.target.value,slug:editing?form.slug:slugify(e.target.value)})} placeholder="Nome do serviço" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
        <input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="Identificador na URL" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      </div>
      <input value={form.short_description} onChange={e=>setForm({...form,short_description:e.target.value})} placeholder="Descrição curta" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição completa" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
      <div className="grid md:grid-cols-3 gap-3">
        <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Categoria" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>
        <select value={form.price_type} onChange={e=>setForm({...form,price_type:e.target.value as ServiceForm['price_type']})} className="px-3 py-2 rounded-xl bg-black border border-white/10">
          <option value="fixed">Preço fixo</option>
          <option value="starting_at">A partir de</option>
          <option value="quote">Sob orçamento</option>
        </select>
        <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as ServiceForm['status']})} className="px-3 py-2 rounded-xl bg-black border border-white/10">
          <option value="draft">Rascunho</option>
          <option value="published">Publicado</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>
      {form.price_type==='fixed'&&<input value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Preço em R$ (ex.: 250,00)" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>}
      {form.price_type==='starting_at'&&<input value={form.starting_price} onChange={e=>setForm({...form,starting_price:e.target.value})} placeholder="Preço inicial em R$" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10"/>}
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Ativo</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Destaque</label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>{editing?'Salvar alterações':'Criar serviço'}</Button>
        <Button type="button" variant="secondary" onClick={()=>setShowForm(false)}>Cancelar</Button>
      </div>
    </form>}

    <div className="space-y-3">{rows.map(service=><div key={service.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4">
      <div>
        <b>{service.name}</b>
        <p className="text-sm text-gray-400 mt-1">{service.short_description||'Sem descrição curta'}</p>
        <p className="text-xs text-gray-500 mt-1">{rotulo(tipoPrecoServico,service.price_type)} · {rotulo(statusPublicacao,service.status)} · {service.active?'Ativo':'Inativo'}</p>
      </div>
      <div className="flex gap-2 items-start">
        <button onClick={()=>openEdit(service)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Editar</button>
        <button onClick={async()=>{await portalApi.saveService({active:!service.active},service.id);await load()}} className="px-3 py-2 rounded-lg bg-white/5 text-sm">{service.active?'Desativar':'Ativar'}</button>
      </div>
    </div>)}</div>
  </div>
}
