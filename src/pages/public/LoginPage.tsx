import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
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
      {/* Left panel — decorative */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d0d0f 0%, #1a0a0a 100%)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <Link to="/"><img src={logoUrl} alt="Play Moments" style={{ height: 32 }} /></Link>
        <div>
          <div className="max-w-lg">
            <p className="text-xs uppercase tracking-[.2em] font-bold mb-4" style={{color:'#ff5364'}}>Sua experiência Play Moments</p>
            <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.05] mb-5" style={{ color: '#f0f0f2' }}>Tudo o que você cria,<br/><span style={{ color: '#E30613' }}>aprende e acompanha.</span></h2>
            <p className="leading-relaxed max-w-md" style={{ color: '#858593' }}>Entre para continuar seus cursos na Academia, acompanhar projetos e pedidos, acessar arquivos e manter suas conversas organizadas.</p>
            <div className="grid grid-cols-2 gap-3 mt-8 max-w-md">{['Academia e cursos','Projetos e pedidos','Arquivos organizados','Conversas em um só lugar'].map((item,i)=><div key={item} className="px-4 py-3 rounded-xl text-xs" style={{background:'rgba(255,255,255,.035)',border:'1px solid rgba(255,255,255,.06)',color:'#b0b0ba'}}><span style={{color:'#E30613'}}>{['▶','◇','↗','◌'][i]}</span> <span className="ml-2">{item}</span></div>)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: '#4b4b55' }}><span>© {new Date().getFullYear()} Play Moments</span><Link to="/academia" className="hover:text-white">Conhecer a Academia →</Link></div>

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

          <p className="text-xs uppercase tracking-[.18em] font-bold mb-3" style={{color:'#E30613'}}>Área pessoal</p><h1 className="text-3xl font-extrabold mb-2" style={{ color: '#f0f0f2' }}>Acesse sua conta</h1>
          <p className="text-sm mb-7 leading-relaxed" style={{ color: '#777784' }}>Continue de onde parou na Play Moments. Ainda não tem conta? <Link to={authLink('/cadastro', from)} className="font-semibold" style={{ color: '#ff5364' }}>Criar gratuitamente</Link>.</p>

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
          <div className="mt-6 pt-5 border-t border-white/[.06] flex items-center justify-between gap-3"><span className="text-xs text-gray-600">Quer apenas conhecer os cursos?</span><Link to="/academia" className="text-xs font-bold text-[#ff5364]">Ver Academia →</Link></div>
        </div>
      </div>
    </div>
  )
}
