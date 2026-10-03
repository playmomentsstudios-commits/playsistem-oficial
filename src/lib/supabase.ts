import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

const canonicalUrl = projectId ? `https://${projectId}.supabase.co` : ''
const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const configuredAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const configuredProjectMatches =
  configuredUrl.length > 0 &&
  configuredUrl.includes(`${projectId}.supabase.co`)

const supabaseUrl = configuredProjectMatches ? configuredUrl : canonicalUrl
const supabaseAnonKey =
  configuredProjectMatches && configuredAnonKey
    ? configuredAnonKey
    : publicAnonKey

if (!supabaseUrl) {
  throw new Error('Supabase URL não configurada.')
}

if (!supabaseAnonKey) {
  throw new Error('Supabase anon key não configurada.')
}

if (configuredUrl && !configuredProjectMatches) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL aponta para outro projeto; usando o projeto canônico da Play Moments.',
  )
} else if (!configuredUrl || !configuredAnonKey) {
  console.warn(
    '[supabase] Variáveis VITE_SUPABASE_* ausentes; usando a configuração pública canônica da Play Moments.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
