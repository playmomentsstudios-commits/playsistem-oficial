import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { authLink, safeReturnPath } from '../../lib/navigation'
import { notificationIdFromCode } from '../../lib/notificationLink'

export function NotificationLinkPage() {
  const { code = '' } = useParams()
  const { user, isLoading, isAuthenticated } = useAuth()
  const id = notificationIdFromCode(code)
  const [result, setResult] = useState<{ key: string; path: string | null; failed: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${user?.id}:${code}:${attempt}`

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || !id) return
    let active = true
    setResult(null)
    // RLS and the explicit recipient filter prevent forwarded links from
    // exposing another customer's notification or destination.
    void supabase.from('notifications').select('link').eq('id', id).eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        const path = safeReturnPath(data?.link)
        const allowed = path && /^\/(app|admin)(\/|$)/.test(path)
        setResult({ key, path: allowed ? path : null, failed: Boolean(error) })
      }, () => { if (active) setResult({ key, path: null, failed: true }) })
    return () => { active = false }
  }, [id, code, user?.id, isLoading, isAuthenticated, key])

  const current = result?.key === key ? result : null
  if (id && !isLoading && !isAuthenticated) return <Navigate to={authLink('/login', `/n/${code}`)} replace />
  if (current?.path) return <Navigate to={current.path} replace />
  const unavailable = !id || (current && !current.path)
  return <main className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b] text-gray-300">
    {unavailable ? <div className="max-w-sm text-center space-y-4">
      <h1 className="text-xl font-bold text-white">{current?.failed ? 'Não foi possível abrir agora' : 'Link indisponível para esta conta'}</h1>
      <p className="text-sm">{current?.failed ? 'Verifique sua conexão e tente novamente.' : 'Entre com a conta que recebeu esta notificação ou consulte seus projetos.'}</p>
      {current?.failed && <button className="block mx-auto text-[#DFA269]" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}
      <Link className="inline-block text-[#DFA269]" to={user?.role === 'admin' || user?.role === 'staff' ? '/admin/notificacoes' : '/app/notificacoes'}>Abrir minhas notificações</Link>
    </div> : <p role="status">Abrindo atualização…</p>}
  </main>
}
