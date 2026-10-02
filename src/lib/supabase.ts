import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'

const fallbackUrl = projectId ? `https://${projectId}.supabase.co` : ''
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey

if (!supabaseUrl) {
  throw new Error('Supabase URL não configurada.')
}

if (!supabaseAnonKey) {
  throw new Error('Supabase anon key não configurada.')
}

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('[supabase] Variáveis VITE_SUPABASE_* ausentes; usando configuração pública de fallback do projeto.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
