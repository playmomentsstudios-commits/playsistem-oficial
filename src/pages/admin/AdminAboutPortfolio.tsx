import { useEffect,useMemo,useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { portalApi } from '../../api/portal'
import { projectEligibleForPortfolio } from '../../lib/portfolioEligibility'
import { projectProgress } from '../../lib/projectProgress'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi,type PortfolioCategory,type PortfolioItem,type SiteProfile } from '../../services/siteContent'

const emptyItem:Partial<PortfolioItem>&{title:string}={title:'',client:'',short_description:'',description:'',cover_url:'',project_url:'',year:new Date().getFullYear(),featured:false,active:false,display_order:0,category_id:null,source_project_id:null}

export function AdminAboutPortfolio(){
  const toast=useToast()
  const [tab,setTab]=useState<'perfil'|'portfolio'|'categorias'>('perfil')
  const [searchParams]=useSearchParams()
  const [profile,setProfile]=useState<SiteProfile|null>(null)
  const [categories,setCategories]=useState<PortfolioCategory[]>([])
  const [items,setItems]=useState<PortfolioItem[]>([])
  const [projects,setProjects]=useState<any[]>([])
  const [coverUploading,setCoverUploading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [itemForm,setItemForm]=useState<any>(emptyItem)
  const [categoryName,setCategoryName]=useState('')

  async function load(){
    const [p,c,i,operational]=await Promise.all([siteContentApi.profile(),siteContentApi.portfolioCategories(true),siteContentApi.portfolioItems(true),portalApi.projects().catch(()=>[])])
    setProfile(p);setCategories(c);setItems(i);setProjects(operational)
  }
  useEffect(()=>{void load()},[])
  useEffect(()=>{
    const source=searchParams.get('projeto')
    if(source){setTab('portfolio');setItemForm((current:any)=>({...current,source_project_id:source,active:false}))}
  },[searchParams])
  const eligibleProjects=useMemo(()=>projects.filter(projectEligibleForPortfolio),[projects])
  const linkedProject=projects.find(project=>project.id===itemForm.source_project_id)
  const projectReady=projectEligibleForPortfolio(linkedProject)

  async function saveProfile(){
    if(!profile)return
    try{setSaving(true);setProfile(await siteContentApi.updateProfile(profile));toast('Quem Somos atualizado.','success')}
    catch(error:any){toast(error.message||'Não foi possível salvar.','error')}
    finally{setSaving(false)}
  }

  async function uploadPhoto(file:File|null){
    if(!file||!profile)return
    try{setSaving(true);const asset=await siteContentApi.uploadSiteAsset(file,'PROFILE');setProfile(await siteContentApi.updateProfile({photo_url:asset.url}));toast('Foto atualizada.','success')}
    catch(error:any){toast(error.message||'Não foi possível enviar a foto.','error')}
    finally{setSaving(false)}
  }

  async function uploadResume(file:File|null){
    if(!file||!profile)return
    try{setSaving(true);const asset=await siteContentApi.uploadSiteAsset(file,'RESUME');setProfile(await siteContentApi.updateProfile({resume_url:asset.url}));toast('Currículo anexado.','success')}
    catch(error:any){toast(error.message||'Não foi possível enviar o currículo.','error')}
    finally{setSaving(false)}
  }

  async function saveItem(){
    if(!itemForm.title?.trim()){toast('Informe o título do projeto.','error');return}
    if(!itemForm.source_project_id){toast('Selecione um projeto concluído em 100% no painel operacional.','error');return}
    if(!itemForm.id && !projectReady){toast('Esse projeto ainda não está concluído em 100%.','error');return}
    if(items.some(row=>row.source_project_id===itemForm.source_project_id && row.id!==itemForm.id)){
      toast('Este projeto já está vinculado a uma ficha de portfólio. Edite a ficha existente.','error');return
    }
    if(itemForm.active){
      if(!projectReady){toast('Para publicar, o projeto precisa estar concluído em 100%.','error');return}
      if(!itemForm.cover_url?.trim() || !itemForm.short_description?.trim() || !itemForm.category_id){
        toast('Antes de publicar, inclua capa, resumo público e categoria.','error');return
      }
    }
    try{
      setSaving(true)
      await siteContentApi.savePortfolioItem({...itemForm,active:Boolean(itemForm.active)})
      setItemForm(emptyItem)
      await load()
      toast('Ficha de portfólio salva. A publicação depende da aprovação e do projeto em 100%.','success')
    }catch(error:any){
      toast(error?.message||'Não foi possível salvar o portfólio.','error')
    }finally{setSaving(false)}
  }

  return <div>
    <div className="mb-6"><h1 className="text-2xl font-bold">Quem Somos & Portfólio</h1><p className="text-sm text-gray-500">Edite sua apresentação, números, ferramentas, métodos, soluções e trabalhos exibidos no site público.</p></div>

    <div className="flex gap-2 mb-6 overflow-x-auto">
      {([['perfil','Perfil e números'],['portfolio','Portfólio'],['categorias','Categorias']] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'px-4 min-h-11 rounded-xl text-sm whitespace-nowrap '+(tab===id?'bg-[#A65A2A] text-white':'bg-white/[0.05] text-gray-400')}>{label}</button>)}
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
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <h3 className="font-semibold">Ferramentas</h3>
          <p className="text-xs text-gray-500 mt-1">Um grupo por linha no formato: Grupo | item 1, item 2, item 3</p>
          <textarea
            rows={10}
            value={(profile.tools||[]).map(group=>group.group+' | '+group.items.join(', ')).join('\n')}
            onChange={e=>setProfile({...profile,tools:e.target.value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [group,...rest]=line.split('|');return {group:(group||'Geral').trim(),items:rest.join('|').split(',').map(item=>item.trim()).filter(Boolean)}})})}
            className="mt-3 w-full p-3 rounded-xl bg-black border border-white/10 text-xs"
          />
        </div>
        <div className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <h3 className="font-semibold">Métodos</h3>
          <p className="text-xs text-gray-500 mt-1">Um método por linha: Título | descrição</p>
          <textarea
            rows={10}
            value={(profile.methods||[]).map(item=>item.title+' | '+item.description).join('\n')}
            onChange={e=>setProfile({...profile,methods:e.target.value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [title,...rest]=line.split('|');return {title:(title||'Método').trim(),description:rest.join('|').trim()}})})}
            className="mt-3 w-full p-3 rounded-xl bg-black border border-white/10 text-xs"
          />
        </div>
        <div className="p-4 rounded-2xl bg-[#141416] border border-white/10">
          <h3 className="font-semibold">Soluções</h3>
          <p className="text-xs text-gray-500 mt-1">Uma solução por linha: Título | descrição</p>
          <textarea
            rows={10}
            value={(profile.solutions||[]).map(item=>item.title+' | '+item.description).join('\n')}
            onChange={e=>setProfile({...profile,solutions:e.target.value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [title,...rest]=line.split('|');return {title:(title||'Solução').trim(),description:rest.join('|').trim()}})})}
            className="mt-3 w-full p-3 rounded-xl bg-black border border-white/10 text-xs"
          />
        </div>
      </div>

      <Button onClick={saveProfile} loading={saving}>Salvar Quem Somos</Button>
    </div>}

    {tab==='portfolio'&&<div className="space-y-5">
      <div className="rounded-2xl border border-[#A65A2A]/30 bg-[#A65A2A]/[0.07] p-4 sm:p-5">
        <p className="text-sm font-semibold text-[#DFA269]">Portfólio vinculado a projetos 100% concluídos</p>
        <p className="text-sm text-gray-300 leading-6 mt-2">Somente projetos marcados como <b>Concluídos</b>, com todas as tarefas e checklists finalizados, podem entrar aqui. Prepare a apresentação com capa e resumo e marque <b>Publicar no site</b> quando estiver pronta. A publicação nunca é automática.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span>{eligibleProjects.length} projetos elegíveis</span><span>·</span><span>{items.filter(item=>item.active && projectEligibleForPortfolio(projects.find(project=>project.id===item.source_project_id))).length} liberados</span>
          <Link to="/admin/projetos" className="ml-auto text-[#DFA269] font-semibold hover:underline">Ver projetos e tarefas ↗</Link>
        </div>
      </div>

      <div className="grid xl:grid-cols-[390px_1fr] gap-5">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#141416] border border-white/10 h-fit space-y-4">
          <div>
            <h2 className="font-bold text-lg">{itemForm.id?'Editar ficha de portfólio':'Preparar nova ficha'}</h2>
            <p className="text-xs text-gray-400 mt-1">Os dados operacionais nunca são copiados automaticamente para o site.</p>
          </div>
          <label className="block text-xs font-semibold text-gray-300">Projeto operacional concluído
            <select required value={itemForm.source_project_id||''}
              onChange={e=>setItemForm({...itemForm,source_project_id:e.target.value||null,active:false})}
              className="mt-2 block w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
              <option value="">Selecione um projeto em 100%</option>
              {linkedProject&&!projectReady&&<option value={linkedProject.id}>{linkedProject.title} — não elegível</option>}
              {!linkedProject&&itemForm.source_project_id&&<option value={itemForm.source_project_id}>Projeto anterior indisponível</option>}
              {eligibleProjects.map(project=><option key={project.id} value={project.id}>{project.title} · 100%</option>)}
            </select>
          </label>
          {linkedProject&&<div className="flex flex-wrap justify-between gap-2 text-xs border border-white/10 bg-white/[0.04] rounded-xl p-3">
            <span className={projectReady?'text-emerald-300':'text-amber-300'}>{projectReady?'Pronto para publicação':'Ainda não está 100% concluído'}</span>
            <span className="text-gray-400">Progresso: {projectProgress(linkedProject)}%</span>
            <Link className="text-[#DFA269] hover:underline" to={'/admin/projetos/'+linkedProject.id}>Abrir projeto ↗</Link>
          </div>}
          {eligibleProjects.length===0&&!itemForm.id&&<p className="text-xs text-amber-300 leading-5">Ainda não há projetos finalizados em 100% para selecionar. Quando concluir um pelo painel Projetos, ele aparecerá nesta lista.</p>}
          <label className="block text-xs font-semibold text-gray-300">Título público
            <input value={itemForm.title||''} onChange={e=>setItemForm({...itemForm,title:e.target.value})} placeholder="Nome da entrega" className="mt-2 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <label className="block text-xs font-semibold text-gray-300">Cliente / organização (opcional)
            <input value={itemForm.client||''} onChange={e=>setItemForm({...itemForm,client:e.target.value})} placeholder="Exibir apenas se autorizado" className="mt-2 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <label className="block text-xs font-semibold text-gray-300">Categoria
            <select value={itemForm.category_id||''} onChange={e=>setItemForm({...itemForm,category_id:e.target.value||null})} className="mt-2 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
              <option value="">Selecionar categoria</option>
              {categories.filter(cat=>cat.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-300">Resumo público
            <textarea value={itemForm.short_description||''} onChange={e=>setItemForm({...itemForm,short_description:e.target.value})} rows={3} placeholder="Descrição breve, sem dados internos ou confidenciais" className="mt-2 w-full p-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <label className="block text-xs font-semibold text-gray-300">Descrição completa (opcional)
            <textarea value={itemForm.description||''} onChange={e=>setItemForm({...itemForm,description:e.target.value})} rows={4} placeholder="Processo criativo e resultado" className="mt-2 w-full p-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <label className="block text-xs font-semibold text-gray-300">Link público do trabalho (opcional)
            <input value={itemForm.project_url||''} onChange={e=>setItemForm({...itemForm,project_url:e.target.value})} placeholder="https://..." className="mt-2 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <div>
            <p className="text-xs font-semibold text-gray-300">Capa pública</p>
            {itemForm.cover_url&&<img src={itemForm.cover_url} alt="Prévia da capa do projeto" className="mt-2 rounded-xl w-full aspect-video object-cover border border-white/10"/>}
            <label className="mt-2 min-h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-xs cursor-pointer hover:bg-white/[0.1]">
              <input type="file" accept="image/*" disabled={coverUploading} className="sr-only" onChange={async e=>{
                const file=e.target.files?.[0];if(!file)return
                try{setCoverUploading(true);const asset=await siteContentApi.uploadSiteAsset(file,'PORTFOLIO');setItemForm((current:any)=>({...current,cover_url:asset.url}));toast('Capa enviada.','success')}
                catch(error:any){toast(error?.message||'Erro ao enviar a capa.','error')}finally{setCoverUploading(false);e.target.value=''}
              }}/>
              {coverUploading?'Enviando capa…':itemForm.cover_url?'Substituir capa':'Enviar capa'}
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-white/[0.035] border border-white/10 p-3 cursor-pointer">
            <input type="checkbox" checked={Boolean(itemForm.active)} disabled={!projectReady && !itemForm.active}
              onChange={e=>setItemForm({...itemForm,active:e.target.checked})} className="mt-1 accent-[#A65A2A]"/>
            <span className="text-xs text-gray-300 leading-5"><strong className="block text-sm text-white">Publicar no site</strong>
              Eu revisei capa, textos e nomes e autorizo a exibição desta ficha no portfólio da SAGAMENTE.
              {!projectReady&&<span className="block mt-1 text-amber-300">Disponível somente com projeto 100% concluído.</span>}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveItem} loading={saving||coverUploading}>{itemForm.id?'Salvar alterações':'Salvar ficha'}</Button>
            {itemForm.id&&<Button variant="secondary" onClick={()=>setItemForm(emptyItem)}>Nova ficha</Button>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <h3 className="font-bold">Fichas do portfólio</h3>
            <p className="text-xs text-gray-500">{items.length} cadastradas</p>
          </div>
          {items.length===0&&<div className="p-7 bg-[#141416] border border-white/10 rounded-2xl text-center text-sm text-gray-400">Nenhum projeto foi preparado para o portfólio. Os trabalhos só serão publicados depois de concluídos e revisados.</div>}
          <div className="grid md:grid-cols-2 gap-3">{items.map(item=>{
            const completed=projectEligibleForPortfolio(projects.find(project=>project.id===item.source_project_id))
            const visible=item.active&&completed&&Boolean(item.cover_url?.trim()&&item.short_description?.trim())
            return <article key={item.id} className="p-3 rounded-2xl bg-[#141416] border border-white/10">
              <div className="aspect-[16/9] rounded-xl overflow-hidden bg-black/20">{item.cover_url?<img src={item.cover_url} alt={item.title} className="w-full h-full object-cover"/>:<div className="h-full grid place-items-center text-xs text-gray-500">Capa não adicionada</div>}</div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-sm">{item.title}</p>
                <span className={'text-[10px] font-semibold px-2 py-1 rounded-full '+(visible?'bg-emerald-500/10 text-emerald-300':'bg-amber-500/10 text-amber-300')}>{visible?'Publicado':'Rascunho / não elegível'}</span>
              </div>
              {item.client&&<p className="text-xs text-gray-500 mt-1">{item.client}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={()=>{setItemForm(item);window.scrollTo({top:0,behavior:'smooth'})}} className="px-3 min-h-10 rounded-lg bg-white/[0.06] hover:bg-white/10 text-xs">Editar</button>
                <button type="button" onClick={async()=>{if(confirm('Excluir esta ficha do portfólio? O projeto operacional permanece intacto.')){await siteContentApi.deletePortfolioItem(item.id);await load()}}} className="px-3 min-h-10 rounded-lg bg-red-500/10 text-red-400 text-xs">Excluir ficha</button>
              </div>
            </article>
          })}</div>
        </div>
      </div>
    </div>}

    {tab==='categorias'&&<div className="max-w-2xl"><div className="flex gap-2 mb-4"><input value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="Nova categoria" className="flex-1 min-h-11 px-3 rounded-xl bg-black border border-white/10"/><Button onClick={async()=>{if(categoryName.trim()){await siteContentApi.saveCategory({name:categoryName.trim()});setCategoryName('');await load()}}}>Adicionar</Button></div><div className="space-y-2">{categories.map(cat=><div key={cat.id} className="p-3 rounded-xl bg-[#141416] border border-white/8 flex items-center justify-between gap-3"><span>{cat.name}</span><button onClick={async()=>{if(confirm('Excluir categoria? Os projetos permanecerão sem categoria.')){await siteContentApi.deleteCategory(cat.id);await load()}}} className="text-xs text-red-400">Excluir</button></div>)}</div></div>}
  </div>
}
