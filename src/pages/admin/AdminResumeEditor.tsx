import { useEffect,useState } from 'react'
import { Link,useNavigate,useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi,type Resume } from '../../services/siteContent'

type ExperienceEntry={title?:string;role?:string;description?:string}

function emptyResume():Partial<Resume>{
  return {
    resume_type:'mini',status:'draft',internal_title:'',slug:'',eyebrow:'',display_name:'',headline:'',summary:'',identity_text:'',callout:'',
    location:'',market_since:null,photo_url:'',photo_drive_file_id:null,contact_email:'',contact_phone:'',instagram:'',linkedin_url:'',
    website_url:'',whatsapp:'',skills:[],experience:[],portfolio:[],extra_sections:[],seo_title:'',seo_description:'',seo_image_url:'',seo_image_drive_file_id:null,
  }
}
const fieldClass='w-full min-h-11 px-3 rounded-xl bg-black/50 border border-white/10 outline-none focus:border-[#E30613]/60'
const textareaClass='w-full p-3 rounded-xl bg-black/50 border border-white/10 outline-none focus:border-[#E30613]/60 resize-y'

export function AdminResumeEditor(){
  const {id}=useParams()
  const navigate=useNavigate()
  const toast=useToast()
  const creating=!id||id==='novo'
  const [form,setForm]=useState<Partial<Resume>>(emptyResume())
  const [loading,setLoading]=useState(!creating)
  const [saving,setSaving]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [uploadProgress,setUploadProgress]=useState(0)
  const [uploadingSeoImage,setUploadingSeoImage]=useState(false)

  useEffect(()=>{
    if(creating){setForm(emptyResume());setLoading(false);return}
    setLoading(true)
    siteContentApi.resumeById(id!)
      .then(row=>{if(!row)throw new Error('Currículo não encontrado.');setForm(row)})
      .catch((error:any)=>{toast(error.message||'Não foi possível carregar o currículo.','error');navigate('/admin/curriculos',{replace:true})})
      .finally(()=>setLoading(false))
  },[id,creating])

  function set<K extends keyof Resume>(key:K,value:Resume[K]|null){
    setForm(current=>({...current,[key]:value}))
  }

  function updateExperience(index:number,key:keyof ExperienceEntry,value:string){
    const next=[...(form.experience||[])] as ExperienceEntry[]
    next[index]={...next[index],[key]:value}
    set('experience',next)
  }

  function addExperience(){
    set('experience',[...((form.experience||[]) as ExperienceEntry[]),{title:'',role:'',description:''}])
  }

  function removeExperience(index:number){
    set('experience',((form.experience||[]) as ExperienceEntry[]).filter((_,itemIndex)=>itemIndex!==index))
  }

  async function save(){
    try{
      setSaving(true)
      const saved=await siteContentApi.saveResume(form)
      setForm(saved)
      if(creating)navigate('/admin/curriculos/'+saved.id,{replace:true})
      toast('Currículo salvo.','success')
    }catch(error:any){
      toast(error.message||'Não foi possível salvar o currículo.','error')
    }finally{
      setSaving(false)
    }
  }

  async function uploadPhoto(file?:File){
    if(!file)return
    if(!file.type.startsWith('image/')){toast('Selecione uma imagem válida.','error');return}
    try{
      setUploading(true);setUploadProgress(1)
      const asset=await siteContentApi.uploadSiteAsset(file,'PROFILE',value=>setUploadProgress(value))
      setForm(current=>({...current,photo_url:asset.url,photo_drive_file_id:asset.driveFileId}))
      toast('Foto enviada para o Google Drive.','success')
    }catch(error:any){
      toast(error.message||'Não foi possível enviar a foto.','error')
    }finally{
      setUploading(false);setUploadProgress(0)
    }
  }

  async function uploadSeoImage(file?:File){
    if(!file)return
    if(!file.type.startsWith('image/')){toast('Selecione uma imagem válida.','error');return}
    try{
      setUploadingSeoImage(true)
      const asset=await siteContentApi.uploadSiteAsset(file,'PROFILE')
      setForm(current=>({...current,seo_image_url:asset.url,seo_image_drive_file_id:asset.driveFileId}))
      toast('Imagem de compartilhamento enviada.','success')
    }catch(error:any){
      toast(error.message||'Não foi possível enviar a imagem de compartilhamento.','error')
    }finally{setUploadingSeoImage(false)}
  }

  if(loading)return <div className="pm-surface p-8 text-sm text-gray-500">Carregando currículo...</div>

  const title=form.internal_title||form.display_name||(creating?'Novo currículo':'Currículo')
  const experiences=(form.experience||[]) as ExperienceEntry[]

  return <div className="max-w-6xl mx-auto space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex items-start gap-3">
        <Link to="/admin/curriculos" className="w-10 h-10 rounded-xl border border-white/10 bg-white/[.04] flex items-center justify-center text-gray-400 hover:text-white shrink-0" aria-label="Voltar">←</Link>
        <div>
          <p className="text-[11px] uppercase tracking-[.22em] text-[#ff6674] font-bold">{creating?'Novo currículo':'Editar currículo'}</p>
          <h1 className="text-xl md:text-2xl font-bold mt-1">{title}</h1>
          <p className="text-xs text-gray-600 mt-1">Preencha somente o que fizer sentido para esta versão.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!creating&&form.status==='published'&&form.slug&&<a href={'/curriculos/'+form.slug} target="_blank" rel="noreferrer" className="min-h-11 px-4 rounded-xl border border-white/10 bg-white/[.04] inline-flex items-center text-sm font-semibold">Abrir página ↗</a>}
        <Button onClick={()=>void save()} loading={saving}>Salvar currículo</Button>
      </div>
    </div>

    <section className="pm-surface p-4 md:p-6 space-y-5">
      <div>
        <h2 className="font-semibold">Configuração da versão</h2>
        <p className="text-xs text-gray-600 mt-1">Esses dados organizam a página no painel e definem o endereço público.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500 md:col-span-2">Título interno
          <input className={fieldClass+' mt-1'} value={form.internal_title||''} onChange={e=>set('internal_title',e.target.value)} placeholder="Ex.: Minicurrículo — Fundo Quilombola"/>
        </label>
        <label className="text-xs text-gray-500">Tipo
          <select className={fieldClass+' mt-1'} value={form.resume_type||'mini'} onChange={e=>set('resume_type',e.target.value as Resume['resume_type'])}>
            <option value="mini">Minicurrículo</option><option value="complete">Currículo completo</option><option value="portfolio">Currículo + portfólio</option><option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="text-xs text-gray-500 md:col-span-2">Slug / endereço
          <div className="mt-1 flex rounded-xl overflow-hidden border border-white/10 bg-black/50"><span className="hidden sm:flex items-center px-3 text-[11px] text-gray-600 border-r border-white/10">/curriculos/</span><input className="flex-1 min-w-0 min-h-11 px-3 bg-transparent outline-none" value={form.slug||''} onChange={e=>set('slug',e.target.value)} placeholder="gerado automaticamente se ficar vazio"/></div>
        </label>
        <label className="text-xs text-gray-500">Status
          <select className={fieldClass+' mt-1'} value={form.status||'draft'} onChange={e=>set('status',e.target.value as Resume['status'])}>
            <option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option>
          </select>
        </label>
      </div>
    </section>

    <section className="pm-surface p-4 md:p-6">
      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <div>
          <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
            {form.photo_url?<img src={form.photo_url} alt="" className="w-full h-full object-cover"/>:<span className="text-5xl font-black text-gray-800">FC</span>}
          </div>
          <label className={'mt-3 min-h-11 rounded-xl border border-white/10 flex items-center justify-center text-xs font-semibold '+(uploading?'bg-white/[.03] text-gray-600 cursor-wait':'bg-white/[.06] hover:bg-white/[.09] cursor-pointer')}>
            <input disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={e=>void uploadPhoto(e.target.files?.[0])}/>
            {uploading?'Enviando '+uploadProgress+'%':form.photo_url?'Trocar foto':'Adicionar foto'}
          </label>
          {uploading&&<div className="mt-2 h-1.5 rounded-full bg-white/[.06] overflow-hidden"><div className="h-full bg-[#E30613] transition-all" style={{width:uploadProgress+'%'}}/></div>}
          <p className="text-[10px] leading-relaxed text-gray-600 mt-2">JPG, PNG, WebP ou AVIF. O arquivo é armazenado no Google Drive.</p>
        </div>

        <div className="space-y-3">
          <div><h2 className="font-semibold">Apresentação</h2><p className="text-xs text-gray-600 mt-1">A página pública esconde automaticamente os campos vazios.</p></div>
          <label className="text-xs text-gray-500 block">Linha superior<input className={fieldClass+' mt-1'} value={form.eyebrow||''} onChange={e=>set('eyebrow',e.target.value)} placeholder="Minicurrículo · Design & Comunicação"/></label>
          <label className="text-xs text-gray-500 block">Nome<input className={fieldClass+' mt-1'} value={form.display_name||''} onChange={e=>set('display_name',e.target.value)} placeholder="Felipe Costa Souza"/></label>
          <label className="text-xs text-gray-500 block">Título profissional<input className={fieldClass+' mt-1'} value={form.headline||''} onChange={e=>set('headline',e.target.value)} placeholder="Designer e comunicador quilombola Kalunga"/></label>
          <label className="text-xs text-gray-500 block">Frase de impacto<input className={fieldClass+' mt-1'} value={form.callout||''} onChange={e=>set('callout',e.target.value)} placeholder="Design também é território, identidade e memória."/></label>
        </div>
      </div>
    </section>

    <section className="pm-surface p-4 md:p-6 space-y-4">
      <div><h2 className="font-semibold">Texto do currículo</h2><p className="text-xs text-gray-600 mt-1">Para um minicurrículo, normalmente estes dois campos já resolvem a apresentação.</p></div>
      <label className="text-xs text-gray-500 block">Apresentação<textarea className={textareaClass+' mt-1'} rows={5} value={form.summary||''} onChange={e=>set('summary',e.target.value)} placeholder="Um resumo curto e forte sobre sua trajetória."/></label>
      <label className="text-xs text-gray-500 block">Identidade, território e trajetória<textarea className={textareaClass+' mt-1'} rows={7} value={form.identity_text||''} onChange={e=>set('identity_text',e.target.value)} placeholder="Contexto que faça sentido para esta versão do currículo. Separe parágrafos com uma linha em branco."/></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">Localização<input className={fieldClass+' mt-1'} value={form.location||''} onChange={e=>set('location',e.target.value)} placeholder="Cavalcante, Goiás"/></label>
        <label className="text-xs text-gray-500">Atuação desde<input type="number" className={fieldClass+' mt-1'} value={form.market_since??''} onChange={e=>set('market_since',e.target.value?Number(e.target.value):null)} placeholder="2008"/></label>
      </div>
      <label className="text-xs text-gray-500 block">Competências
        <span className="block text-[10px] text-gray-600 mt-1">Uma por linha.</span>
        <textarea className={textareaClass+' mt-2'} rows={5} value={(form.skills||[]).join('\n')} onChange={e=>set('skills',e.target.value.split('\n').map(v=>v.trim()).filter(Boolean))} placeholder={'Identidade visual\nDesign editorial\nWebdesign\nComunicação comunitária'}/>
      </label>
    </section>

    <section className="pm-surface p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Participações e projetos</h2>
          <p className="text-xs text-gray-600 mt-1">Opcional. Use para destacar experiências diretamente ligadas ao objetivo deste currículo.</p>
        </div>
        <Button variant="secondary" onClick={addExperience}>+ Adicionar participação</Button>
      </div>

      {experiences.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-600">Nenhuma participação adicionada. Esta seção não aparece na página pública enquanto estiver vazia.</div>}

      <div className="space-y-3">
        {experiences.map((item,index)=><div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-300">Participação {index+1}</p>
              <p className="text-[10px] text-gray-600 mt-1">Projeto, organização, território ou rede.</p>
            </div>
            <button type="button" onClick={()=>removeExperience(index)} className="text-xs text-red-400 hover:text-red-300">Remover</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">Título<input className={fieldClass+' mt-1'} value={item.title||''} onChange={e=>updateExperience(index,'title',e.target.value)} placeholder="Ex.: Instituto Sumaúma — pesquisa quilombola"/></label>
            <label className="text-xs text-gray-500">Sua atuação<input className={fieldClass+' mt-1'} value={item.role||''} onChange={e=>updateExperience(index,'role',e.target.value)} placeholder="Ex.: Diagramação e webdesign"/></label>
          </div>
          <label className="text-xs text-gray-500 block mt-3">Descrição<textarea className={textareaClass+' mt-1'} rows={3} value={item.description||''} onChange={e=>updateExperience(index,'description',e.target.value)} placeholder="Explique em poucas linhas o que foi desenvolvido e por que essa experiência é relevante."/></label>
        </div>)}
      </div>
    </section>

    <section className="pm-surface p-4 md:p-6">
      <div><h2 className="font-semibold">Contatos</h2><p className="text-xs text-gray-600 mt-1">O telefone também pode abrir o WhatsApp automaticamente na página pública. Se o campo WhatsApp estiver vazio, usamos o telefone como referência.</p></div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="text-xs text-gray-500">E-mail<input type="email" className={fieldClass+' mt-1'} value={form.contact_email||''} onChange={e=>set('contact_email',e.target.value)} placeholder="nome@email.com"/></label>
        <label className="text-xs text-gray-500">Telefone<input className={fieldClass+' mt-1'} value={form.contact_phone||''} onChange={e=>set('contact_phone',e.target.value)} placeholder="(62) 99999-9999"/></label>
        <label className="text-xs text-gray-500">Instagram<input className={fieldClass+' mt-1'} value={form.instagram||''} onChange={e=>set('instagram',e.target.value)} placeholder="@usuario"/></label>
        <label className="text-xs text-gray-500">WhatsApp opcional<input className={fieldClass+' mt-1'} value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="se for diferente do telefone"/></label>
        <label className="text-xs text-gray-500">LinkedIn<input className={fieldClass+' mt-1'} value={form.linkedin_url||''} onChange={e=>set('linkedin_url',e.target.value)} placeholder="linkedin.com/in/..."/></label>
        <label className="text-xs text-gray-500">Site / portfólio<input className={fieldClass+' mt-1'} value={form.website_url||''} onChange={e=>set('website_url',e.target.value)} placeholder="https://..."/></label>
      </div>
    </section>

    <details className="pm-surface p-4 md:p-6">
      <summary className="cursor-pointer font-semibold">SEO opcional</summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="text-xs text-gray-500">Título SEO<input className={fieldClass+' mt-1'} value={form.seo_title||''} onChange={e=>set('seo_title',e.target.value)}/></label>
        <label className="text-xs text-gray-500">Descrição SEO<input className={fieldClass+' mt-1'} value={form.seo_description||''} onChange={e=>set('seo_description',e.target.value)}/></label>
        <div className="sm:col-span-2 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-500">Imagem de compartilhamento (WhatsApp, LinkedIn e redes sociais)</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
            {form.seo_image_url&&<img src={form.seo_image_url} alt="" className="w-full sm:w-48 aspect-[1.91/1] rounded-lg object-cover border border-white/10"/>}
            <label className={'min-h-11 px-4 rounded-xl border border-white/10 inline-flex items-center justify-center text-xs font-semibold '+(uploadingSeoImage?'opacity-60 cursor-wait':'cursor-pointer bg-white/[.06] hover:bg-white/[.09]')}>
              <input disabled={uploadingSeoImage} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={e=>void uploadSeoImage(e.target.files?.[0])}/>
              {uploadingSeoImage?'Enviando...':form.seo_image_url?'Trocar imagem':'Adicionar imagem'}
            </label>
            {form.seo_image_url&&<button type="button" className="text-xs text-red-400" onClick={()=>setForm(current=>({...current,seo_image_url:'',seo_image_drive_file_id:null}))}>Remover</button>}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Recomendado: 1200 × 630 px. Se ficar vazio, a foto do currículo será usada como alternativa.</p>
        </div>
      </div>
    </details>

    <div className="sticky bottom-3 z-20 rounded-2xl border border-white/10 bg-[#0d0d0f]/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
      <Link to="/admin/curriculos" className="text-sm text-gray-400 hover:text-white">Cancelar</Link>
      <Button onClick={()=>void save()} loading={saving}>Salvar currículo</Button>
    </div>
  </div>
}
