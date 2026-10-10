import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isStandaloneApp } from '../lib/pwa'

// New installs open /abrir-app. Older icons may open / or /instalar.
// Redirect only the first standalone navigation, never a deliberate "Ver site".
let legacyStandaloneLaunchPending = typeof window !== 'undefined'
  && (window.location.pathname === '/' || window.location.pathname === '/instalar')
  && isStandaloneApp()

export function LegacyStandaloneLanding({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [redirectOnMount] = useState(() => legacyStandaloneLaunchPending)
  useEffect(() => {
    if (!redirectOnMount) return
    legacyStandaloneLaunchPending = false
    navigate('/abrir-app', { replace: true })
  }, [navigate, redirectOnMount])
  if (redirectOnMount) return <div role="status" className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-sm text-gray-300">Abrindo Sagamente…</div>
  return <>{children}</>
}

export function AppLaunchRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div role="status" className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-sm text-gray-300">Carregando sua área…</div>
  if (!isAuthenticated || !user) return <Navigate to="/login?next=%2Fabrir-app" replace />
  return <Navigate to={user.role === 'admin' || user.role === 'staff' ? '/admin' : '/app/dashboard'} replace />
}
