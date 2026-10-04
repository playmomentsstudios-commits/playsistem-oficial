import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { LoginExperiencePanel, LoginMobileExperience } from '../../components/auth/LoginExperiencePanel'
import { afterAuthPath, authLink, safeReturnPath } from '../../lib/navigation'
import logoUrl from '../../assets/logo-play-moments.png'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const { login, user, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const previous = location.state?.from
  const from = safeReturnPath(new URLSearchParams(location.search).get('next')) ?? safeReturnPath(previous?.pathname ? previous.pathname + (previous.search || '') + (previous.hash || '') : null)
  if (!isLoading && user) return <Navigate to={afterAuthPath(from, user.role)} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!email) errs.email = 'Informe o e-mail'
    if (!password) errs.password = 'Informe a senha'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const signedIn = await login({ email, password })
      toast('Login realizado com sucesso!', 'success')
      navigate(afterAuthPath(from, signedIn.role), { replace: true })
    } catch (err: any) {
      toast(err.message || 'Erro ao fazer login.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0b' }}>
      <LoginExperiencePanel />

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-start lg:justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm">
          <LoginMobileExperience />
          <Link to="/" className="lg:hidden flex justify-center mb-6">
            <img src={logoUrl} alt="Play Moments" style={{ height: 26 }} />
          </Link>

          <p className="text-[10px] sm:text-xs uppercase tracking-[.18em] font-bold mb-2 sm:mb-3" style={{color:'#E30613'}}>Área pessoal</p><h1 className="text-[1.85rem] sm:text-3xl font-extrabold mb-2" style={{ color: '#f0f0f2' }}>Acesse sua conta</h1>
          <p className="text-sm mb-6 sm:mb-7 leading-relaxed" style={{ color: '#777784' }}>Continue de onde parou na Play Moments. Ainda não tem conta? <Link to={authLink('/cadastro', from)} className="font-semibold" style={{ color: '#ff5364' }}>Criar gratuitamente</Link>.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 sm:gap-4">
            <Input label="E-mail" type="email" placeholder="seu@email.com"
              value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
            <Input label="Senha" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />

            <div className="flex justify-end">
              <Link to="/esqueci-senha" className="text-xs" style={{ color: '#6b6b78' }}>
                Esqueci minha senha
              </Link>
            </div>

            <Button type="submit" fullWidth loading={loading} size="lg">
              Entrar
            </Button>
          </form>
          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/[.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3"><span className="text-xs text-gray-600">Quer apenas conhecer os cursos?</span><Link to="/academia" className="text-xs font-bold text-[#ff5364]">Ver Academia →</Link></div>
        </div>
      </div>
    </div>
  )
}
