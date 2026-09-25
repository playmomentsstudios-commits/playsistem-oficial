import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import logoUrl from '../../assets/logo-play-moments.png'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/app/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!email) errs.email = 'Informe o e-mail'
    if (!password) errs.password = 'Informe a senha'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      await login({ email, password })
      toast('Login realizado com sucesso!', 'success')
      navigate(from, { replace: true })
    } catch (err: any) {
      toast(err.message || 'Erro ao fazer login.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0b' }}>
      {/* Left panel — decorative */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d0d0f 0%, #1a0a0a 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <Link to="/"><img src={logoUrl} alt="Play Moments" style={{ height: 32 }} /></Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight mb-4" style={{ color: '#f0f0f2' }}>
            Bem-vindo de<br />
            <span style={{ color: '#E30613' }}>volta.</span>
          </h2>
          <p style={{ color: '#6b6b78' }}>Acesse seu portal e acompanhe seus projetos, pedidos e conversas.</p>
        </div>
        <div className="text-xs" style={{ color: '#3a3a42' }}>© 2024 Play Moments</div>

        {/* Glow */}
        <div style={{ position: 'absolute', bottom: '20%', left: '30%', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(227,6,19,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden block mb-8">
            <img src={logoUrl} alt="Play Moments" style={{ height: 28 }} />
          </Link>

          <h1 className="text-2xl font-bold mb-2" style={{ color: '#f0f0f2' }}>Entrar</h1>
          <p className="text-sm mb-8" style={{ color: '#6b6b78' }}>
            Não tem conta? <Link to="/cadastro" style={{ color: '#E30613' }}>Criar agora</Link>
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        </div>
      </div>
    </div>
  )
}
