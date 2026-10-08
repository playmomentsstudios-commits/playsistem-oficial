import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { invalidateBrandSettings, BRAND_DEFAULTS, brandAsset, type BrandVariant } from '../BrandImage'
import { siteContentApi, type SiteSettings } from '../../services/siteContent'

const FIELDS:ReadonlyArray<{key:keyof Pick<SiteSettings,
'brand_logo_dark_url'|'brand_logo_light_url'|'brand_logo_compact_url'|'brand_symbol_url'|
'brand_staff_logo_url'|'brand_favicon_url'|'brand_social_image_url'>;variant:BrandVariant;title:string;description:string;usage:string;imageClass?:string;surface:'dark'|'light';social?:boolean;favicon?:boolean}>=[
  {key:'brand_logo_dark_url',variant:'dark',title:'Logo principal · fundo escuro',description:'Versão horizontal em contraste com carvão e preto.',usage:'Menu público, rodapé, login e painel administrativo',surface:'dark'},
  {key:'brand_logo_light_url',variant:'light',title:'Logo principal · fundo claro',description:'Versão horizontal para superfícies claras.',usage:'Materiais institucionais claros e apresentações',surface:'light'},
  {key:'brand_logo_compact_url',variant:'compact',title:'Logo horizontal compacta',description:'Assinatura reduzida, legível em telas menores.',usage:'Header mobile e espaços estreitos',surface:'dark'},
  {key:'brand_symbol_url',variant:'symbol',title:'Símbolo isolado',description:'Somente a simbologia da SAGAMENTE.',usage:'Quem Somos, animações, portfólio e menu recolhido',surface:'dark',imageClass:'max-h-28 max-w-[60%]'},
  {key:'brand_staff_logo_url',variant:'staff',title:'Logo dos colaboradores',description:'Versão escura aplicada ao painel claro da equipe.',usage:'Menu administrativo do colaborador',surface:'light'},
  {key:'brand_favicon_url',variant:'favicon',title:'Favicon',description:'Marca simplificada, preferencialmente quadrada.',usage:'Aba do navegador e favoritos',surface:'light',favicon:true,imageClass:'w-14 h-14'},
  {key:'brand_social_image_url',variant:'social',title:'Compartilhamento social',description:'Imagem horizontal de marca (recomendado 1200 × 630 pixels).',usage:'WhatsApp, LinkedIn e outras redes quando a página não possui imagem específica',surface:'dark',social:true,imageClass:'max-h-44'},
]
type BrandKey=typeof FIELDS[number]['key']
type Draft=Record<BrandKey,string>

function draftFrom(row:SiteSettings):Draft {
  return Object.fromEntries(FIELDS.map(f=>[f.key,brandAsset(row,f.variant)])) as Draft
}
function validMedia(file:File,field:typeof FIELDS[number]):string|null {
  const allowed=field.social ? ['image/png','image/jpeg','image/webp'] :
    field.favicon ? ['image/png','image/svg+xml','image/webp','image/x-icon','image/vnd.microsoft.icon'] :
    ['image/png','image/webp','image/svg+xml']
  if(!allowed.includes(file.type))return 'Formato não permitido neste campo. Use PNG, WebP ou SVG (imagem social: PNG, JPG ou WebP).'
  if(file.size>(field.social?8:5)*1024*1024)return 'Arquivo acima do limite permitido.'
  return null
}
export function BrandIdentitySettings(){
  const toast=useToast()
  const {user}=useAuth()
  const [row,setRow]=useState<SiteSettings|null>(null)
  const [draft,setDraft]=useState<Draft|null>(null)
  const [color,setColor]=useState('#A65A2A')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [uploading,setUploading]=useState<BrandKey|null>(null)
  const [error,setError]=useState('')
  const canUpload=user?.role==='admin'
  useEffect(()=>{
    let active=true
    void siteContentApi.settings().then(data=>{
      if(!active)return
      setRow(data)
      setDraft(draftFrom(data))
      setColor(data.primary_color||'#A65A2A')
    }).catch(e=>{if(active)setError(e.message||'Falha ao carregar a identidade.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const changed=useMemo(()=>{
    if(!row||!draft)return false
    return color!==(row.primary_color||'#A65A2A') || FIELDS.some(f=>draft[f.key]!==brandAsset(row,f.variant))
  },[row,draft,color])

  const upload=async(field:typeof FIELDS[number],file:File)=>{
    const invalid=validMedia(file,field)
    if(invalid){toast(invalid,'error');return}
    try{
      setUploading(field.key)
      const asset=await siteContentApi.uploadSiteAsset(file,'BRAND')
      setDraft(current=>current?{...current,[field.key]:asset.url}:current)
      toast('Arquivo salvo no Drive. Clique em "Publicar identidade" para aplicar no site.','success')
    }catch(e:any){toast(e?.message||'Não foi possível enviar a imagem.','error')}
    finally{setUploading(null)}
  }
  const save=async()=>{
    if(!draft||!row)return
    try{
      setSaving(true)
      const next=await siteContentApi.updateSettings({...draft,primary_color:color})
      setRow(next)
      setDraft(draftFrom(next))
      invalidateBrandSettings(next)
      toast('Identidade publicada. As interfaces conectadas serão atualizadas.','success')
    }catch(e:any){toast(e.message||'Não foi possível salvar a identidade.','error')}
    finally{setSaving(false)}
  }

  if(loading)return <div role="status" className="p-8 text-sm text-gray-400">Carregando identidade visual...</div>
  if(!row||!draft)return <div role="alert" className="p-5 border border-red-500/20 rounded-xl text-red-300">{error||'Identidade indisponível. Tente atualizar a página.'}</div>
  return <div className="space-y-6">
    <section className="p-5 rounded-2xl border border-white/10 bg-[#141416]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[.15em] uppercase text-[#DFA269]">Centro da identidade</p>
          <h2 className="text-xl font-bold mt-1">Identidade da Marca</h2>
        </div>
        <span className={'text-xs font-medium px-3 py-2 rounded-full '+(changed?'bg-amber-500/10 text-amber-200':'bg-emerald-500/10 text-emerald-300')}>{changed?'Alterações não publicadas':'Identidade salva'}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-400">Gerencie as versões oficiais da marca em um único lugar. Os arquivos são guardados no Google Drive; o banco registra apenas seus endereços. A substituição mantém os arquivos anteriores para recuperação.</p>
      {!canUpload&&<p className="mt-3 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-200">Somente o Admin Mestre pode enviar novas imagens para o Drive.</p>}
    </section>

    <div className="grid sm:grid-cols-2 gap-4">
      {FIELDS.map(field=><section key={field.key} className="p-4 sm:p-5 rounded-2xl bg-[#141416] border border-white/10 flex flex-col">
        <div>
          <h3 className="font-semibold text-base">{field.title}</h3>
          <p className="text-xs text-gray-400 leading-5 mt-1">{field.description}</p>
        </div>
        <div className={'mt-4 rounded-xl border border-white/10 min-h-[155px] p-5 flex items-center justify-center '+(field.surface==='light'?'bg-[#E7E1D7]':'bg-[#0A0A0B]')}>
          {draft[field.key] ? <img src={draft[field.key]} className={'max-h-32 max-w-full object-contain '+(field.imageClass||'')} alt={'Prévia: '+field.title} onError={e=>{e.currentTarget.style.opacity='.35'}}/> :
            <p className="text-xs text-gray-400">Imagem ainda não configurada</p>}
        </div>
        <p className="text-xs text-gray-500 leading-5 mt-3 flex-1"><span className="text-gray-300">Aplicação:</span> {field.usage}</p>
        <div className="mt-4 flex gap-2 items-center flex-wrap">
          <label className={'min-h-10 px-3 py-2 rounded-lg inline-flex items-center justify-center text-xs font-semibold border border-[#A65A2A]/50 bg-[#A65A2A]/10 text-[#DFA269] '+(!canUpload||uploading?'opacity-50 cursor-not-allowed':'cursor-pointer hover:bg-[#A65A2A]/20')}>
            {uploading===field.key?'Enviando...':'Enviar imagem'}
            <input type="file" className="sr-only" disabled={!canUpload||Boolean(uploading)} accept={field.social?'image/png,image/jpeg,image/webp':field.favicon?'image/png,image/svg+xml,image/webp,image/x-icon':'image/png,image/webp,image/svg+xml'} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(field,file);e.target.value=''}}/>
          </label>
          <button type="button" onClick={()=>setDraft(current=>current?{...current,[field.key]:BRAND_DEFAULTS[field.variant]}:null)} className="min-h-10 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300">Restaurar padrão</button>
        </div>
        {draft[field.key]&&<p className="mt-3 text-[10px] text-gray-600 break-all max-h-10 overflow-hidden" title={draft[field.key]}>{draft[field.key]}</p>}
      </section>)}
    </div>
    <section className="rounded-2xl border border-white/10 bg-[#141416] p-5">
      <label className="block text-xs font-semibold text-gray-300" htmlFor="identity-primary-color">Cor principal da marca</label>
      <div className="flex items-center gap-3 mt-3">
        <input id="identity-primary-color" type="color" value={color} onChange={e=>setColor(e.target.value)} className="h-12 w-14 bg-transparent cursor-pointer"/>
        <input aria-label="Código hexadecimal da cor principal" value={color} onChange={e=>{if(/^#[a-fA-F0-9]{6}$/.test(e.target.value))setColor(e.target.value)}} className="w-32 h-11 rounded-lg border border-white/10 bg-black px-3 text-sm font-mono"/>
        <span className="text-xs text-gray-500">Acentos, botões e destaques do site.</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">Os estados de erro, aviso e sucesso não são alterados pela cor da marca.</p>
    </section>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-4 bg-[#101112]">
      <button type="button" disabled={!changed||saving||Boolean(uploading)} onClick={()=>void save()} className="min-h-12 px-6 rounded-xl bg-[#A65A2A] hover:bg-[#81431E] disabled:opacity-50 text-sm font-semibold text-white">
        {saving?'Publicando...':'Publicar identidade'}
      </button>
      <button type="button" disabled={!changed||saving} onClick={()=>{setDraft(draftFrom(row));setColor(row.primary_color||'#A65A2A')}} className="min-h-11 px-4 rounded-xl border border-white/10 text-sm text-gray-300">Descartar alterações</button>
      <p className="text-xs text-gray-500">As outras abas de Gestão do Site continuam com conteúdo, SEO e contatos, sem controles de logo duplicados.</p>
    </div>
    <p className="text-xs text-gray-500">Certificados emitidos e documentos históricos não serão modificados. A imagem de compartilhamento será usada apenas quando não houver uma capa específica para a página.</p>
    <Link to="/admin/academia/certificados" className="inline-flex text-xs text-[#DFA269] hover:underline">Modelos de certificados possuem timbrados próprios →</Link>
  </div>
}
