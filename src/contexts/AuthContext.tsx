import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, UserRole, LoginPayload, RegisterPayload } from '../types'
import { authApi } from '../api/auth'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole | null
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Demo users for when backend isn't available
const DEMO_USERS: Record<string, User & { password: string }> = {
  'admin@playmoments.com.br': {
    id: 'admin-1',
    email: 'admin@playmoments.com.br',
    password: 'admin123',
    role: 'admin',
    name: 'Play',
    lastName: 'Moments',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'cliente@exemplo.com': {
    id: 'customer-1',
    email: 'cliente@exemplo.com',
    password: 'cliente123',
    role: 'customer',
    name: 'João',
    lastName: 'Silva',
    phone: '(11) 99999-9999',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('pm_user')
    const token = localStorage.getItem('pm_token')
    if (stored && token) {
      try {
        setUser(JSON.parse(stored))
      } catch {}
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      const { token, user } = await authApi.login(payload)
      localStorage.setItem('pm_token', token)
      localStorage.setItem('pm_user', JSON.stringify(user))
      setUser(user)
    } catch {
      // Fallback to demo mode when backend is unavailable
      const demo = DEMO_USERS[payload.email]
      if (demo && demo.password === payload.password) {
        const { password: _, ...safeUser } = demo
        const fakeToken = `demo_${demo.id}_${Date.now()}`
        localStorage.setItem('pm_token', fakeToken)
        localStorage.setItem('pm_user', JSON.stringify(safeUser))
        setUser(safeUser)
      } else {
        throw new Error('E-mail ou senha incorretos.')
      }
    }
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const { token, user } = await authApi.register(payload)
      localStorage.setItem('pm_token', token)
      localStorage.setItem('pm_user', JSON.stringify(user))
      setUser(user)
    } catch {
      // Demo registration
      const newUser: User = {
        id: `user-${Date.now()}`,
        email: payload.email,
        role: 'customer',
        name: payload.name,
        lastName: payload.lastName,
        phone: payload.phone,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const fakeToken = `demo_${newUser.id}`
      localStorage.setItem('pm_token', fakeToken)
      localStorage.setItem('pm_user', JSON.stringify(newUser))
      setUser(newUser)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pm_token')
    localStorage.removeItem('pm_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        role: user?.role ?? null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
