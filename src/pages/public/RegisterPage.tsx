import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { afterAuthPath, authLink, safeReturnPath } from '../../lib/navigation'
import logoUrl from '../../assets/logo-play-moments.png'

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', lastName: '', email: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { register, user, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const next = safeReturnPath(new URLSearchParams(location.search).get('next'))
  if (!isLoading && user) return <Navigate to={afterAuthPath(next, user.role)} replace />

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Informe o nome'
    if (!form.lastName) errs.lastName = 'Informe o sobrenome'
    if (!form.email) errs.email = 'Informe o e-mail'
    if (!form.password || form.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    if (form.password !== form.confirm) errs.confirm = 'As senhas não coincidem'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const result = await register({
        name: form.name,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      }, next)

      if (result.requiresEmailConfirmation) {
        toast('Conta criada. Confira seu e-mail para confirmar o cadastro.', 'success')
        navigate(authLink('/login', next))
        return
      }

      toast('Conta criada com sucesso!', 'success')
      navigate(afterAuthPath(next, 'customer'))
    } catch (err: any) {
      toast(err.message || 'Erro ao criar conta.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0a0a0b' }}>
      <div className="w-full max-w-md">
        <Link to="/"><img src={logoUrl} alt="Play Moments" style={{ height: 28, marginBottom: 32 }} /></Link>

        <h1 className="text-2xl font-bold mb-2" style={{ color: '#f0f0f2' }}>Criar conta</h1>
        <p className="text-sm mb-8" style={{ color: '#6b6b78' }}>
          Já tem conta? <Link to={authLink('/login', next)} style={{ color: '#E30613' }}>Entrar</Link>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" placeholder="João" value={form.name} onChange={set('name')} error={errors.name} />
            <Input label="Sobrenome" placeholder="Silva" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
          </div>
          <Input label="E-mail" type="email" placeholder="seu@email.com" value={form.email} onChange={set('email')} error={errors.email} />
          <Input label="Telefone (opcional)" type="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={set('phone')} />
          <Input label="Senha" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} error={errors.password} />
          <Input label="Confirmar senha" type="password" placeholder="Repita a senha" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />

          <Button type="submit" fullWidth loading={loading} size="lg">
            Criar conta
          </Button>

          <p className="text-xs text-center" style={{ color: '#6b6b78' }}>
            Ao criar uma conta, você concorda com os nossos termos de uso.
          </p>
        </form>
      </div>
    </div>
  )
}
