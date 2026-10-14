import { supabase } from '../lib/supabase'

export type AcademyAppSettings = {
 id: boolean
 hero_eyebrow: string
 hero_title: string
 hero_subtitle: string
 show_quick_links: boolean
 show_courses: boolean
 updated_at: string
 updated_by: string | null
}

export const DEFAULT_ACADEMY_APP_SETTINGS: AcademyAppSettings = {
 id: true,
 hero_eyebrow: 'ACADEMIA SAGAMENTE',
 hero_title: 'Histórias para ouvir. Ideias para transformar.',
 hero_subtitle: 'Seus conteúdos favoritos, no seu ritmo.',
 show_quick_links: true,
 show_courses: true,
 updated_at: '',
 updated_by: null,
}

export async function readAcademyAppSettings(): Promise<AcademyAppSettings> {
 const { data, error } = await supabase.from('academy_app_settings').select('*').eq('id', true).maybeSingle()
 if (error) throw error
 return { ...DEFAULT_ACADEMY_APP_SETTINGS, ...(data || {}) } as AcademyAppSettings
}

export async function saveAcademyAppSettings(
 input: Pick<AcademyAppSettings,'hero_eyebrow'|'hero_title'|'hero_subtitle'|'show_quick_links'|'show_courses'>
): Promise<AcademyAppSettings> {
 const { data: {user}, error: authError } = await supabase.auth.getUser()
 if (authError || !user) throw new Error('Entre novamente na sua conta de administrador.')
 const hero_eyebrow = input.hero_eyebrow.trim()
 const hero_title = input.hero_title.trim()
 const hero_subtitle = input.hero_subtitle.trim()
 if (!hero_eyebrow || hero_eyebrow.length > 48 || !hero_title || hero_title.length > 110 || !hero_subtitle || hero_subtitle.length > 200) {
  throw new Error('Confira os textos: etiqueta até 48, título até 110 e descrição até 200 caracteres.')
 }
 const { data,error } = await supabase.from('academy_app_settings')
  .update({ hero_eyebrow,hero_title,hero_subtitle,show_quick_links:input.show_quick_links,
   show_courses:input.show_courses,updated_at:new Date().toISOString(),updated_by:user.id })
  .eq('id',true).select('*').single()
 if (error) throw error
 return data as AcademyAppSettings
}
