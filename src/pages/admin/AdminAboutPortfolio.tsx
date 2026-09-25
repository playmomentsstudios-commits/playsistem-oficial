import { useEffect,useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi,type PortfolioCategory,type PortfolioItem,type SiteProfile } from '../../services/siteContent'

const emptyItem:Partial<PortfolioItem>&{title:string}={title:'',client:'',short_description:'',description:'',cover_url:'',project_url:'',year:new Date().getFullYear(),featured:false,active:true,display_order:0,category_id:null}

export function AdminAboutPortfolio(){
  const toast=useToast()
  const [tab,setTab]=useState<'perfil'|'portfolio'|'categorias'>('perfil')
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [categories,setCategories]=useState<PortfolioCategory[]>([])
  const [items,setItems]=useState<PortfolioItem[]>([])
  const [saving,setSaving]=useState(false)
  const [itemForm,setItemForm]=useState<any>(emptyItem)
  const [categoryName,setCategoryName]=useState('')

  async function load(){
    const [p,c,i]=await Promise.all([siteContentApi.profile(),siteContentApi.portfolioCategories(true),siteContentApi.portfolioItems(true)])
    setProfile(p);setCategories(c);setItems(i)
  }
  useEffect(()=>{void load()},[])

  async function saveProfile(){
    if(!profile)return
    try{setSaving(true);setProfile(await siteContentApi.updateProfile(profile));toast('Quem Somos atualizado.','success')}
    catch(error:any){toast(error.message||'Não foi possível salvar.','error')}
    finally{setSaving(false)}
  }

  async function uploadPhoto(file:File|null){
    if(!file||!profile)return
    try{setSaving(true);const url=await siteContentApi.uploadSiteAsset(file,'profile');setProfile(await siteContentApi.updateProfile({photo_url:url}));toast('Foto atualizada.','success')}
    catch(error:any){toast(error.message||'Não foi possível enviar a foto.','error')}
    finally{setSaving(false)}
  }

  async function uploadResume(file:File|null){
    if(!file||!profile)return
    try{setSaving(true);const url=await siteContentApi.uploadSiteAsset(file,'resume');setProfile(await siteContentApi.updateProfile({resume_url:url}));toast('Currículo anexado.','success')}
    catch(error:any){toast(error.message||'Não foi possível enviar o currículo.','error')}
    finally{setSaving(false)}
  }

  async function saveItem(){
    if(!itemForm.title?.trim())return
    try{setSaving(true);await siteContentApi.savePortfolioItem(itemForm);setItemForm(emptyItem);await load();toast('Projeto salvo.','success')}
    catch(error:any){toast(error.message||'Não foi possível salvar o projeto.','error')}
    finally{setSaving(false)}
  }

  return <div>
    <div className="mb-6"><h1 className="text-2xl font-bold">Quem Somos & Portfólio</h1><p className="text-sm text-gray-500">Edite sua apresentação, currículo, números e trabalhos exibidos no site público.</p></div>

    <div className="flex gap-2 mb-6 overflow-x-auto">
      {([['perfil','Perfil e números'],['portfolio','Portfólio'],['categorias','Categorias']] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'px-4 min-h-11 rounded-xl text-sm whitespace-nowrap '+(tab===id?'bg-[#E30613] text-white':'bg-white/[0.05] text-gray-400')}>{label}</button>)}
    </div>

    {tab==='perfil'&&profile&&<div className="max-w-4xl space-y-5">
      <div className="grid md:grid-cols-[220px_1fr] gap-5">
        <div className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <div className="aspect-[4/5] rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">{profile.photo_url?<img src={profile.photo_url} alt="" className="w-full h-full object-cover"/>:<span className="text-4xl text-gray-700">Foto</span>}</div>
          <label className="mt-3 min-h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-xs font-semibold cursor-pointer"><input type="file" accept="image/*" className="sr-only" onChange={e=>void uploadPhoto(e.target.files?.[0]||null)}/>Trocar foto</label>
          <label className="mt-2 min-h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-xs font-semibold cursor-pointer"><input type="file" accept="application/pdf" className="sr-only" onChange={e=>void uploadResume(e.target.files?.[0]||null)}/>{profile.resume_url?'Substituir currículo PDF':'Anexar currículo PDF'}</label>
        </div>
        <div className="space-y-3">
          <input value={profile.display_name} onChange={e=>setProfile({...profile,display_name:e.target.value})} className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10" placeholder="Nome"/>
          <input value={profile.headline} onChange={e=>setProfile({...profile,headline:e.target.value})} className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10" placeholder="Headline profissional"/>
          <textarea value={profile.intro} onChange={e=>setProfile({...profile,intro:e.target.value})} rows={3} className="w-full p-3 rounded-xl bg-black border border-white/10" placeholder="Apresentação"/>
          <textarea value={profile.story} onChange={e=>setProfile({...profile,story:e.target.value})} rows={5} className="w-full p-3 rounded-xl bg-black border border-white/10" placeholder="História"/>
          <textarea value={profile.objective} onChange={e=>setProfile({...profile,objective:e.target.value})} rows={4} className="w-full p-3 rounded-xl bg-black border border-white/10" placeholder="Objetivo"/>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="text-xs text-gray-500">Projetos<input value={profile.projects_delivered_label} onChange={e=>setProfile({...profile,projects_delivered_label:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
        <label className="text-xs text-gray-500">Clientes<input value={profile.clients_served_label} onChange={e=>setProfile({...profile,clients_served_label:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
        <label className="text-xs text-gray-500">Desde<input type="number" value={profile.market_since} onChange={e=>setProfile({...profile,market_since:Number(e.target.value)})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
        <label className="text-xs text-gray-500">Satisfação<input value={profile.satisfaction_label} onChange={e=>setProfile({...profile,satisfaction_label:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/></label>
      </div>
      <Button onClick={saveProfile} loading={saving}>Salvar Quem Somos</Button>
    </div>}

    {tab==='portfolio'&&<div className="grid xl:grid-cols-[380px_1fr] gap-5">
      <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 h-fit space-y-3">
        <h2 className="font-bold">{itemForm.id?'Editar projeto':'Adicionar projeto'}</h2>
        <input value={itemForm.title||''} onChange={e=>setItemForm({...itemForm,title:e.target.value})} placeholder="Título" className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
        <input value={itemForm.client||''} onChange={e=>setItemForm({...itemForm,client:e.target.value})} placeholder="Cliente / organização" className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
        <select value={itemForm.category_id||''} onChange={e=>setItemForm({...itemForm,category_id:e.target.value||null})} className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <textarea value={itemForm.short_description||''} onChange={e=>setItemForm({...itemForm,short_description:e.target.value})} rows={2} placeholder="Resumo" className="w-full p-3 rounded-xl bg-black border border-white/10"/>
        <textarea value={itemForm.description||''} onChange={e=>setItemForm({...itemForm,description:e.target.value})} rows={4} placeholder="Descrição completa" className="w-full p-3 rounded-xl bg-black border border-white/10"/>
        <input value={itemForm.project_url||''} onChange={e=>setItemForm({...itemForm,project_url:e.target.value})} placeholder="Link do projeto" className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
        <label className="min-h-11 rounded-xl bg-white/[0.06] flex items-center justify-center text-xs cursor-pointer"><input type="file" accept="image/*" className="sr-only" onChange={async e=>{const f=e.target.files?.[0];if(f)setItemForm({...itemForm,cover_url:await siteContentApi.uploadSiteAsset(f,'portfolio')})}}/>Enviar capa</label>
        <div className="flex gap-2"><Button onClick={saveItem} loading={saving}>{itemForm.id?'Atualizar':'Adicionar'}</Button>{itemForm.id&&<Button variant="secondary" onClick={()=>setItemForm(emptyItem)}>Cancelar</Button>}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">{items.map(item=><div key={item.id} className="p-3 rounded-2xl bg-[#141416] border border-white/10"><div className="aspect-[16/9] rounded-xl overflow-hidden bg-black/20">{item.cover_url&&<img src={item.cover_url} className="w-full h-full object-cover"/>}</div><p className="font-semibold mt-3">{item.title}</p><p className="text-xs text-gray-500">{item.client}</p><div className="flex gap-2 mt-3"><button onClick={()=>setItemForm(item)} className="px-3 min-h-10 rounded-lg bg-white/[0.06] text-xs">Editar</button><button onClick={async()=>{if(confirm('Excluir este projeto?')){await siteContentApi.deletePortfolioItem(item.id);await load()}}} className="px-3 min-h-10 rounded-lg bg-red-500/10 text-red-400 text-xs">Excluir</button></div></div>)}</div>
    </div>}

    {tab==='categorias'&&<div className="max-w-2xl"><div className="flex gap-2 mb-4"><input value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Nova categoria" className="flex-1 min-h-11 px-3 rounded-xl bg-black border border-white/10"/><Button onClick={async()=>{if(categoryName.trim()){await siteContentApi.saveCategory({name:categoryName.trim()});setCategoryName('');await load()}}}>Adicionar</Button></div><div className="space-y-2">{categories.map(cat=><div key={cat.id} className="p-3 rounded-xl bg-[#141416] border border-white/8 flex items-center justify-between gap-3"><span>{cat.name}</span><button onClick={async()=>{if(confirm('Excluir categoria? Os projetos permanecerão sem categoria.')){await siteContentApi.deleteCategory(cat.id);await load()}}} className="text-xs text-red-400">Excluir</button></div>)}</div></div>}
  </div>
}
