import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { afterAuthPath, authLink, safeReturnPath } from '../../lib/navigation'
import logoUrl from '../../assets/logo-play-moments.png'

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', lastName: '', email: '', phone: '', documentNumber: '', postalCode: '', street: '', addressNumber: '', addressComplement: '', neighborhood: '', city: '', state: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [states, setStates] = useState<Array<{ id: number; sigla: string; nome: string }>>([])
  const [cities, setCities] = useState<Array<{ id: number; nome: string }>>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { register, user, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const next = safeReturnPath(new URLSearchParams(location.search).get('next'))
  if (!isLoading && user) return <Navigate to={afterAuthPath(next, user.role)} replace />

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setStates).catch(() => setStates([]))
  }, [])

  useEffect(() => {
    if (!form.state) { setCities([]); return }
    setLoadingCities(true)
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + form.state + '/municipios?orderBy=nome')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setCities).catch(() => setCities([])).finally(() => setLoadingCities(false))
  }, [form.state])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const state = e.target.value
    setForm(prev => ({ ...prev, state, city: '' }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Informe o nome'
    if (!form.lastName) errs.lastName = 'Informe o sobrenome'
    if (!form.email) errs.email = 'Informe o e-mail'
    if (!form.phone.replace(/\D/g, '')) errs.phone = 'Informe o telefone'
    const document = form.documentNumber.replace(/\D/g, '')
    if (![11, 14].includes(document.length)) errs.documentNumber = 'Informe um CPF ou CNPJ válido'
    if (form.postalCode.replace(/\D/g, '').length !== 8) errs.postalCode = 'Informe um CEP válido'
    if (!form.street.trim()) errs.street = 'Informe a rua ou avenida'
    if (!form.addressNumber.trim()) errs.addressNumber = 'Informe o número'
    if (!form.neighborhood.trim()) errs.neighborhood = 'Informe o bairro'
    if (!form.city.trim()) errs.city = 'Informe a cidade'
    if (form.state.trim().length !== 2) errs.state = 'Informe a UF'
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
        documentNumber: form.documentNumber,
        postalCode: form.postalCode,
        street: form.street,
        addressNumber: form.addressNumber,
        addressComplement: form.addressComplement,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
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
          <Input label="Telefone" type="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <Input label="CPF/CNPJ" placeholder="Somente números ou formatado" value={form.documentNumber} onChange={set('documentNumber')} error={errors.documentNumber} />
          <div className="grid grid-cols-2 gap-3"><Input label="CEP" placeholder="00000-000" value={form.postalCode} onChange={set('postalCode')} error={errors.postalCode} /><Input label="Rua / Avenida" value={form.street} onChange={set('street')} error={errors.street} /></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Número" value={form.addressNumber} onChange={set('addressNumber')} error={errors.addressNumber} /><Input label="Complemento (opcional)" value={form.addressComplement} onChange={set('addressComplement')} /></div>
          <Input label="Bairro" value={form.neighborhood} onChange={set('neighborhood')} error={errors.neighborhood} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-2"><span className="text-xs font-semibold" style={{ color: '#9090a0' }}>Estado</span><select value={form.state} onChange={handleStateChange} className="w-full rounded-xl px-4" style={{ height: 48, background: '#141416', border: '1px solid rgba(255,255,255,.12)', color: '#f0f0f2' }}><option value="">Selecione</option>{states.map(state => <option key={state.id} value={state.sigla}>{state.nome} - {state.sigla}</option>)}</select>{errors.state && <span className="text-xs" style={{ color: '#ff6b7a' }}>{errors.state}</span>}</label>
            <label className="flex flex-col gap-2"><span className="text-xs font-semibold" style={{ color: '#9090a0' }}>Cidade</span><select value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} disabled={!form.state || loadingCities} className="w-full rounded-xl px-4 disabled:opacity-50" style={{ height: 48, background: '#141416', border: '1px solid rgba(255,255,255,.12)', color: '#f0f0f2' }}><option value="">{loadingCities ? 'Carregando...' : 'Selecione'}</option>{cities.map(city => <option key={city.id} value={city.nome}>{city.nome}</option>)}</select>{errors.city && <span className="text-xs" style={{ color: '#ff6b7a' }}>{errors.city}</span>}</label>
          </div>
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
