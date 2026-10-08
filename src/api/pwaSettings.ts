import { supabase } from '../lib/supabase'
import { siteContentApi } from '../services/siteContent'

export type PwaSettings = {
  id: boolean
  name: string
  short_name: string
  description: string
  theme_color: string
  background_color: string
  icon_180_drive_file_id: string | null
  icon_192_drive_file_id: string | null
  icon_512_drive_file_id: string | null
  icon_maskable_drive_file_id: string | null
  updated_at: string
  updated_by: string | null
}
type Draft = Pick<PwaSettings, 'name' | 'short_name' | 'description' | 'theme_color' | 'background_color'
  | 'icon_180_drive_file_id' | 'icon_192_drive_file_id' | 'icon_512_drive_file_id' | 'icon_maskable_drive_file_id'>

export const PWA_DEFAULTS:Draft = {
  name: 'Sagamente — Tecnologia, criação e conhecimento',
  short_name: 'Sagamente',
  description: 'Projetos, serviços, arquivos, cursos e tecnologia em um só lugar.',
  theme_color: '#0a0a0b',
  background_color: '#0a0a0b',
  icon_180_drive_file_id: null,
  icon_192_drive_file_id: null,
  icon_512_drive_file_id: null,
  icon_maskable_drive_file_id: null,
}

export const pwaSettingsApi = {
  async get():Promise<PwaSettings> {
    const { data, error } = await supabase.from('pwa_settings').select('*').eq('id', true).single()
    if(error) throw error
    return data as PwaSettings
  },
  async save(values:Draft):Promise<PwaSettings> {
    if(!values.name.trim() || values.name.trim().length>80) throw new Error('Nome completo precisa ter até 80 caracteres.')
    if(!values.short_name.trim() || values.short_name.trim().length>24) throw new Error('Nome curto precisa ter até 24 caracteres.')
    if(!values.description.trim() || values.description.trim().length>250) throw new Error('Descrição precisa ter até 250 caracteres.')
    if(!/^#[a-f0-9]{6}$/i.test(values.theme_color) || !/^#[a-f0-9]{6}$/i.test(values.background_color))
      throw new Error('Informe cores válidas em hexadecimal.')
    const { data:{ user }, error:authError } = await supabase.auth.getUser()
    if(authError || !user) throw new Error('Entre na sua conta administrativa.')
    const { data, error } = await supabase.from('pwa_settings')
      .update({ ...values, name:values.name.trim(), short_name:values.short_name.trim(),
        description:values.description.trim(), updated_at:new Date().toISOString(), updated_by:user.id })
      .eq('id',true).select().single()
    if(error) throw error
    return data as PwaSettings
  },

  async uploadIconSet(file:File, color:string, onStep?:(step:string)=>void) {
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))
      throw new Error('Use uma imagem PNG, JPG ou WebP.')
    if(file.size>8*1024*1024) throw new Error('O ícone deve ter até 8 MB.')
    if(!/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Escolha uma cor de fundo válida.')
    const image = await createImageBitmap(file)
    try {
      if(image.width!==image.height || image.width<512)
        throw new Error('Envie um ícone quadrado com pelo menos 512 × 512 pixels.')
      async function render(size:number, maskable:boolean):Promise<File> {
        const canvas=document.createElement('canvas')
        canvas.width=size
        canvas.height=size
        const ctx=canvas.getContext('2d')
        if(!ctx)throw new Error('Este navegador não conseguiu preparar o ícone.')
        ctx.fillStyle=color
        ctx.fillRect(0,0,size,size)
        // Android maskable: keep the central artwork within a safe zone.
        const margin=maskable?Math.round(size*0.15):0
        ctx.drawImage(image,margin,margin,size-2*margin,size-2*margin)
        const blob=await new Promise<Blob>((resolve,reject)=>
          canvas.toBlob(value=>value?resolve(value):reject(new Error('Erro ao gerar PNG.')),'image/png'))
        return new File([blob], 'sagamente-pwa-'+size+(maskable?'-maskable':'')+'.png',{type:'image/png'})
      }
      const iconSpecs=[
        {size:180,key:'icon_180_drive_file_id'},
        {size:192,key:'icon_192_drive_file_id'},
        {size:512,key:'icon_512_drive_file_id'},
        {size:512,key:'icon_maskable_drive_file_id',maskable:true},
      ] as const
      const values:Pick<Draft,'icon_180_drive_file_id'|'icon_192_drive_file_id'|'icon_512_drive_file_id'|'icon_maskable_drive_file_id'>={
        icon_180_drive_file_id:null,icon_192_drive_file_id:null,icon_512_drive_file_id:null,icon_maskable_drive_file_id:null
      }
      for(let index=0;index<iconSpecs.length;index++){
        const spec=iconSpecs[index]
        onStep?.('Enviando imagem '+(index+1)+' de '+iconSpecs.length+' ao Google Drive...')
        const asset=await siteContentApi.uploadSiteAsset(await render(spec.size, Boolean('maskable' in spec && spec.maskable)),'BRAND')
        values[spec.key]=asset.driveFileId
      }
      return values
    } finally { image.close() }
  }
}
