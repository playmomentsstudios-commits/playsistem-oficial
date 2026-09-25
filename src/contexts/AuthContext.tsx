import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type {
  User,
  UserRole,
  LoginPayload,
  RegisterPayload,
} from '../types'

interface RegisterResult {
  requiresEmailConfirmation: boolean
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole | null
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload, next?: string | null) => Promise<RegisterResult>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

interface ProfileRow {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  status: 'active' | 'inactive' | 'blocked'
  created_at: string
  updated_at: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function profileToUser(profile: ProfileRow): User {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone ?? undefined,
    avatar: profile.avatar_url ?? undefined,
    status: profile.status,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

async function fetchProfile(authUser: SupabaseUser): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name,phone,avatar_url,role,status,created_at,updated_at')
    .eq('id', authUser.id)
    .single()

  if (error) throw new Error(`Não foi possível carregar o perfil: ${error.message}`)

  const profile = data as ProfileRow
  if (profile.status !== 'active') {
    await supabase.auth.signOut()
    if (profile.status === 'blocked') throw new Error('Esta conta está bloqueada.')
    throw new Error('Esta conta está inativa.')
  }

  return profileToUser(profile)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const syncSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession)
    if (!nextSession?.user) {
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      setUser(await fetchProfile(nextSession.user))
    } catch (error) {
      console.error(error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.error('Erro ao restaurar sessão:', error)
        setUser(null)
        setSession(null)
        setIsLoading(false)
        return
      }
      void syncSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      window.setTimeout(() => void syncSession(nextSession), 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncSession])

  const login = useCallback(async (payload: LoginPayload) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email.trim(),
      password: payload.password,
    })

    if (error) {
      throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
    }
    if (!data.user || !data.session) throw new Error('Não foi possível iniciar a sessão.')

    const appUser = await fetchProfile(data.user)
    setSession(data.session)
    setUser(appUser)
    return appUser
  }, [])

  const register = useCallback(async (payload: RegisterPayload, next?: string | null): Promise<RegisterResult> => {
    const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
    const query = next ? '?' + new URLSearchParams({ next }).toString() : ''

    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        emailRedirectTo: siteUrl + '/email-confirmado' + query,
        data: {
          first_name: payload.name.trim(),
          last_name: payload.lastName.trim(),
          phone: payload.phone?.trim() || null,
        },
      },
    })

    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Não foi possível criar a conta.')
    if (!data.session) return { requiresEmailConfirmation: true }

    const appUser = await fetchProfile(data.user)
    setSession(data.session)
    setUser(appUser)
    return { requiresEmailConfirmation: false }
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    setSession(null)
    setUser(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl + '/redefinir-senha',
    })
    if (error) throw new Error(error.message)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!session && !!user,
      isLoading,
      role: user?.role ?? null,
      login,
      register,
      logout,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
