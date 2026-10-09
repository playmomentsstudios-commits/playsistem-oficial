import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'
import { siteContentApi,type HomeServiceArea } from '../../services/siteContent'
import { BrandIdentitySettings } from '../../components/admin/BrandIdentitySettings'
import { PwaSettings } from '../../components/admin/PwaSettings'

const TABS = ['Geral', 'Identidade da Marca', 'Aplicativo (PWA)', 'Home', 'Rodapé', 'Quem Somos', 'Redes Sociais', 'Contato', 'SEO']

export function AdminSiteSettings() {
  const [tab, setTab] = useState(()=>{const selected=new URLSearchParams(window.location.search).get('tab');return selected==='identidade'?'Identidade da Marca':selected==='aplicativo'?'Aplicativo (PWA)':'Geral'})
  const [loading, setLoading] = useState(false)
  const [initialLoading,setInitialLoading]=useState(true)
  const toast = useToast()
  const [areas,setAreas]=useState<HomeServiceArea[]>([])
  const [areaSaving,setAreaSaving]=useState<string|null>(null)
  const [settings, setSettings] = useState({
    companyName: 'Sagamente',
    description: 'Studio de criação, design digital e tecnologia em equipamentos.',
    heroHeadline: 'Criamos momentos que ficam.',
    heroCta: 'Explorar serviços',
    instagram: '',
    youtube: '',
    tiktok: '',
    linkedin: '',
    whatsapp: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    footerDescription: '',
    homeAreasEyebrow: 'Nossas áreas',
    homeAreasTitle: 'Tudo em um só lugar',
    metaDescription: 'Sagamente — Soluções em design, tecnologia, comunicação e audiovisual.',
  })

  useEffect(()=>{
    siteContentApi.homeServiceAreas(true).then(setAreas).catch(()=>toast('Não foi possível carregar os cards da Home.','error'))
    siteContentApi.settings().then(row=>setSettings({
      companyName:row.company_name,
      description:row.description,
      heroHeadline:row.hero_headline,
      heroCta:row.hero_cta,
      instagram:row.instagram_url||'',
      youtube:row.youtube_url||'',
      tiktok:row.tiktok_url||'',
      linkedin:row.linkedin_url||'',
      whatsapp:row.whatsapp||'',
      email:row.contact_email||'',
      phone:row.contact_phone||'',
      address:row.address||'',
      city:row.city||'',
      state:row.state||'',
      footerDescription:row.footer_description||'',
      homeAreasEyebrow:row.home_areas_eyebrow||'Nossas áreas',
      homeAreasTitle:row.home_areas_title||'Tudo em um só lugar',
      metaDescription:row.meta_description,
    })).catch(()=>toast('Não foi possível carregar as configurações do site.','error')).finally(()=>setInitialLoading(false))
  },[])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSettings(prev => ({ ...prev, [k]: e.target.value }))

  const save = async () => {
    setLoading(true)
    try{
      await siteContentApi.updateSettings({
        company_name:settings.companyName.trim(),
        description:settings.description.trim(),
        hero_headline:settings.heroHeadline.trim(),
        hero_cta:settings.heroCta.trim(),
        instagram_url:settings.instagram.trim()||null,
        youtube_url:settings.youtube.trim()||null,
        tiktok_url:settings.tiktok.trim()||null,
        linkedin_url:settings.linkedin.trim()||null,
        whatsapp:settings.whatsapp.trim()||null,
        contact_email:settings.email.trim()||null,
        contact_phone:settings.phone.trim()||null,
        address:settings.address.trim()||null,
        city:settings.city.trim()||null,
        state:settings.state.trim()||null,
        footer_description:settings.footerDescription.trim()||null,
        home_areas_eyebrow:settings.homeAreasEyebrow.trim()||'Nossas áreas',
        home_areas_title:settings.homeAreasTitle.trim()||'Tudo em um só lugar',
        meta_description:settings.metaDescription.trim(),
      })
      toast('Configurações salvas!','success')
    }catch(error:any){toast(error.message||'Não foi possível salvar as configurações.','error')}
    finally{setLoading(false)}
  }

  const patchArea=(id:string,patch:Partial<HomeServiceArea>)=>setAreas(prev=>prev.map(a=>a.id===id?{...a,...patch}:a))
  const saveArea=async(area:HomeServiceArea)=>{setAreaSaving(area.id);try{const saved=await siteContentApi.saveHomeServiceArea(area);setAreas(prev=>prev.map(a=>a.id===area.id?saved:a));toast('Card da Home salvo.','success')}catch(error:any){toast(error.message||'Não foi possível salvar o card.','error')}finally{setAreaSaving(null)}}
  const addArea=async()=>{try{const saved=await siteContentApi.saveHomeServiceArea({title:'Nova área',icon:'◆',accent_color:'#A65A2A',href:'/servicos',topics:[],display_order:(areas.at(-1)?.display_order||0)+10,active:true});setAreas(prev=>[...prev,saved]);toast('Novo card criado.','success')}catch(error:any){toast(error.message||'Não foi possível criar o card.','error')}}
  const removeArea=async(area:HomeServiceArea)=>{if(!confirm('Excluir o card "'+area.title+'"?'))return;try{await siteContentApi.deleteHomeServiceArea(area.id);setAreas(prev=>prev.filter(a=>a.id!==area.id));toast('Card excluído.','success')}catch(error:any){toast(error.message||'Não foi possível excluir o card.','error')}}
  const uploadAreaImage=async(area:HomeServiceArea,file?:File)=>{if(!file)return;setAreaSaving(area.id);try{const asset=await siteContentApi.uploadSiteAsset(file,'HOME');patchArea(area.id,{image_url:asset.url,image_drive_file_id:asset.driveFileId,image_mime_type:asset.mimeType,image_file_size:asset.fileSize});const saved=await siteContentApi.saveHomeServiceArea({...area,image_url:asset.url,image_drive_file_id:asset.driveFileId,image_mime_type:asset.mimeType,image_file_size:asset.fileSize});setAreas(prev=>prev.map(a=>a.id===area.id?saved:a));toast('Imagem atualizada.','success')}catch(error:any){toast(error.message||'Não foi possível enviar a imagem.','error')}finally{setAreaSaving(null)}}

  if(initialLoading)return <p className="text-gray-400">Carregando configurações...</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#f0f0f2' }}>Configurações do Site</h1>
        <p className="text-sm" style={{ color: '#6b6b78' }}>Personalize o conteúdo e a aparência do site público</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-full max-w-full overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t ? '#A65A2A' : 'transparent',
              color: tab === t ? '#fff' : '#9090a0',
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className={tab==='Home'||tab==='Identidade da Marca'||tab==='Aplicativo (PWA)'?'max-w-5xl':'max-w-2xl'}>
        {tab === 'Identidade da Marca' && <BrandIdentitySettings/>}
        {tab === 'Aplicativo (PWA)' && <PwaSettings/>}

        {tab === 'Geral' && (
          <div className="flex flex-col gap-4">
            <Input label="Nome da empresa" value={settings.companyName} onChange={set('companyName')} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9090a0' }}>Descrição</label>
              <textarea value={settings.description} onChange={set('description')} rows={3}
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f2' }} />
            </div>
            <Input label="Headline principal (Hero)" value={settings.heroHeadline} onChange={set('heroHeadline')} />
            <Input label="Texto do botão CTA" value={settings.heroCta} onChange={set('heroCta')} />
          </div>
        )}

        {tab === 'Home' && (
          <div className="flex flex-col gap-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Chamada da seção" value={settings.homeAreasEyebrow} onChange={set('homeAreasEyebrow')} />
              <Input label="Título da seção" value={settings.homeAreasTitle} onChange={set('homeAreasTitle')} />
            </div>
            <div className="flex items-center justify-between"><div><h2 className="font-bold">Cards de áreas</h2><p className="text-xs text-gray-500">Edite imagem, tópicos, destino e ordem.</p></div><button onClick={addArea} className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm">+ Novo card</button></div>
            {areas.map(area=><div key={area.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-col gap-3">
              {area.image_url&&<img src={area.image_url} alt="" className="w-full h-36 object-cover rounded-xl" />}
              <div className="grid sm:grid-cols-2 gap-3"><Input label="Título" value={area.title} onChange={e=>patchArea(area.id,{title:e.target.value})}/><Input label="Link" value={area.href} onChange={e=>patchArea(area.id,{href:e.target.value})}/><Input label="Ícone" value={area.icon||''} onChange={e=>patchArea(area.id,{icon:e.target.value})}/><Input label="Ordem" type="number" value={String(area.display_order)} onChange={e=>patchArea(area.id,{display_order:Number(e.target.value)})}/></div>
              <div className="flex items-center gap-3"><input type="color" value={area.accent_color} onChange={e=>patchArea(area.id,{accent_color:e.target.value})}/><span className="text-xs text-gray-400">Cor de destaque</span><label className="ml-auto px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-xs cursor-pointer">Trocar imagem<input type="file" accept="image/*" className="hidden" onChange={e=>uploadAreaImage(area,e.target.files?.[0])}/></label></div>
              <div><label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tópicos — um por linha</label><textarea rows={5} value={area.topics.join('\n')} onChange={e=>patchArea(area.id,{topics:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)})} className="mt-1.5 w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-y bg-white/[0.05] border border-white/10"/></div>
              <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={area.active} onChange={e=>patchArea(area.id,{active:e.target.checked})}/> Ativo</label><button disabled={areaSaving===area.id} onClick={()=>saveArea(area)} className="ml-auto px-4 py-2 rounded-xl bg-[#A65A2A] text-white text-sm font-semibold disabled:opacity-50">{areaSaving===area.id?'Salvando...':'Salvar card'}</button><button onClick={()=>removeArea(area)} className="px-3 py-2 rounded-xl border border-red-500/20 text-red-300 text-sm">Excluir</button></div>
            </div>)}
          </div>
        )}

        {tab === 'Rodapé' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Descrição do rodapé</label><textarea value={settings.footerDescription} onChange={set('footerDescription')} rows={3} className="w-full px-4 py-2.5 text-sm rounded-xl outline-none resize-none bg-white/[0.05] border border-white/10"/></div>
            <Input label="Endereço" value={settings.address} onChange={set('address')} />
            <div className="grid sm:grid-cols-2 gap-4"><Input label="Cidade" value={settings.city} onChange={set('city')} /><Input label="Estado / UF" value={settings.state} onChange={set('state')} /></div>
            <p className="text-xs text-gray-500">E-mail, telefone, WhatsApp e redes sociais continuam nas abas Contato e Redes Sociais e são usados automaticamente no rodapé.</p>
          </div>
        )}

        {tab === 'Quem Somos' && (
          <div className="p-5 rounded-2xl bg-[#141416] border border-white/10">
            <h2 className="font-bold text-lg">Quem Somos & Portfólio</h2>
            <p className="text-sm text-gray-500 mt-2">Edite sua bio, história, objetivo, currículo, foto, números da Home, categorias e projetos do portfólio.</p>
            <Link to="/admin/portfolio" className="inline-flex mt-4 min-h-11 px-4 items-center rounded-xl bg-[#A65A2A] text-white text-sm font-semibold">Abrir editor de Quem Somos</Link>
          </div>
        )}

        {tab === 'Redes Sociais' && (
          <div className="flex flex-col gap-4">
            <Input label="Instagram" placeholder="https://instagram.com/..." value={settings.instagram} onChange={set('instagram')} />
            <Input label="YouTube" placeholder="https://youtube.com/..." value={settings.youtube} onChange={set('youtube')} />
            <Input label="TikTok" placeholder="https://tiktok.com/..." value={settings.tiktok} onChange={set('tiktok')} />
            <Input label="LinkedIn" placeholder="https://linkedin.com/..." value={settings.linkedin} onChange={set('linkedin')} />
            <Input label="WhatsApp (número com DDI)" placeholder="+5511999999999" value={settings.whatsapp} onChange={set('whatsapp')} />
          </div>
        )}

        {tab === 'Contato' && (
          <div className="flex flex-col gap-4">
            <Input label="E-mail de contato" type="email" value={settings.email} onChange={set('email')} />
            <Input label="Telefone" value={settings.phone} onChange={set('phone')} />
            <Input label="Endereço" value={settings.address} onChange={set('address')} />
          </div>
        )}

        {tab === 'SEO' && (
          <div className="rounded-2xl bg-[#141416] border border-white/10 p-5">
            <h2 className="font-bold text-base">Central de SEO</h2>
            <p className="text-sm text-gray-400 mt-2">As configurações de SEO agora ficam centralizadas em uma única ferramenta: títulos e descrições por página, palavras-chave, indexação e auditoria.</p>
            <Link to="/admin/seo" className="inline-flex mt-4 min-h-11 px-4 items-center rounded-xl bg-[#A65A2A] text-white text-sm font-semibold">Abrir Central de SEO ↗</Link>
          </div>
        )}

        {tab!=='Identidade da Marca'&&tab!=='Aplicativo (PWA)'&&tab!=='SEO'&&<div className="mt-6">
          <Button onClick={save} loading={loading}>Salvar configurações</Button>
        </div>}
      </div>
    </div>
  )
}
