import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { afterAuthPath, authLink, safeReturnPath } from '../../lib/navigation'
const logoUrl = '/sagamente-logo-dark.svg'

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', lastName: '', email: '', phone: '', documentNumber: '', postalCode: '', street: '', addressNumber: '', addressComplement: '', neighborhood: '', city: '', state: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [states, setStates] = useState<Array<{ id: number; sigla: string; nome: string }>>([])
  const [cities, setCities] = useState<Array<{ id: number; nome: string }>>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [step, setStep] = useState(1)
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

  const digits = (value: string) => value.replace(/\D/g, '')
  const formatPhone = (value: string) => {
    const d = digits(value).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return '(' + d.slice(0,2) + ') ' + d.slice(2)
    if (d.length <= 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6)
    return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7)
  }
  const formatDocument = (value: string) => {
    const d = digits(value).slice(0,14)
    if (d.length <= 11) return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
    return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
  }
  const formatCep = (value: string) => {
    const d = digits(value).slice(0,8)
    return d.length > 5 ? d.slice(0,5) + '-' + d.slice(5) : d
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const lookupCep = async () => {
    const cep = digits(form.postalCode)
    if (cep.length !== 8) return
    try {
      setLoadingCep(true)
      const response = await fetch('https://viacep.com.br/ws/' + cep + '/json/')
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (data.erro) throw new Error()
      setForm(prev => ({
        ...prev,
        postalCode: formatCep(cep),
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        state: data.uf || prev.state,
        city: data.localidade || prev.city,
      }))
      setErrors(prev => ({...prev, postalCode: ''}))
    } catch {
      setErrors(prev => ({...prev, postalCode: 'CEP não encontrado. Preencha o endereço manualmente.'}))
    } finally {
      setLoadingCep(false)
    }
  }

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

  const stepErrors = (targetStep: number) => {
    const all = validate()
    const keys = targetStep === 1
      ? ['name','lastName','email','phone','documentNumber']
      : targetStep === 2
        ? ['postalCode','street','addressNumber','neighborhood','city','state']
        : ['password','confirm']
    return Object.fromEntries(Object.entries(all).filter(([key]) => keys.includes(key)))
  }

  const nextStep = () => {
    const errs = stepErrors(step)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(current => Math.min(3, current + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const previousStep = () => {
    setErrors({})
    setStep(current => Math.max(1, current - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        toast(next === '/carrinho' ? 'Conta criada. Confirme seu e-mail e volte para finalizar sua compra.' : 'Conta criada. Confira seu e-mail para confirmar o cadastro.', 'success')
        navigate(authLink('/login', next))
        return
      }

      toast(next === '/carrinho' ? 'Conta criada! Vamos continuar sua compra.' : 'Conta criada com sucesso!', 'success')
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
        <Link to="/"><img src={logoUrl} alt="Sagamente" style={{ height: 28, marginBottom: 32 }} /></Link>

        <h1 className="text-2xl font-bold mb-2" style={{ color: '#f0f0f2' }}>Criar conta</h1>
        <p className="text-sm mb-4" style={{ color: '#6b6b78' }}>
          Já tem conta? <Link to={authLink('/login', next)} style={{ color: '#A65A2A' }}>Entrar</Link>
        </p>
        {next==='/carrinho'&&<div className="mb-6 p-3 rounded-xl border border-[#A65A2A]/20 bg-[#A65A2A]/5"><p className="text-xs font-semibold" style={{color:'#f0f0f2'}}>🛒 Seu carrinho está esperando</p><p className="text-[11px] mt-1" style={{color:'#6b6b78'}}>Crie sua conta e você volta automaticamente para finalizar a compra.</p></div>}

        <div className="mb-6" aria-label={`Etapa ${step} de 3`}>
          <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
            {[1,2,3].map(item => <div key={item} className="flex-1"><div className="h-1.5 rounded-full" style={{background:item<=step?'#A65A2A':'rgba(255,255,255,.10)'}} /></div>)}
          </div>
          <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider" style={{color:'#6b6b78'}}>
            <span>Seus dados</span><span>Endereço</span><span>Acesso</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step===1&&<>
            <div className="mb-1"><h2 className="font-semibold" style={{color:'#f0f0f2'}}>Seus dados</h2><p className="text-xs mt-1" style={{color:'#6b6b78'}}>Informações básicas para identificar sua conta.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome" autoComplete="given-name" placeholder="João" value={form.name} onChange={set('name')} error={errors.name} />
              <Input label="Sobrenome" autoComplete="family-name" placeholder="Silva" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
            </div>
            <Input label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com" value={form.email} onChange={set('email')} error={errors.email} />
            <Input label="Telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={e=>setForm(prev=>({...prev,phone:formatPhone(e.target.value)}))} error={errors.phone} />
            <Input label="CPF/CNPJ" inputMode="numeric" placeholder="CPF ou CNPJ" value={form.documentNumber} onChange={e=>setForm(prev=>({...prev,documentNumber:formatDocument(e.target.value)}))} error={errors.documentNumber} />
          </>}

          {step===2&&<>
            <div className="mb-1"><h2 className="font-semibold" style={{color:'#f0f0f2'}}>Endereço</h2><p className="text-xs mt-1" style={{color:'#6b6b78'}}>Digite o CEP para preencher boa parte automaticamente.</p></div>
            <Input label="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={form.postalCode} onChange={e=>setForm(prev=>({...prev,postalCode:formatCep(e.target.value)}))} onBlur={()=>void lookupCep()} error={errors.postalCode} hint={loadingCep?'Buscando endereço...':'Preenchimento automático pelo CEP'} />
            <Input label="Rua / Avenida" autoComplete="street-address" value={form.street} onChange={set('street')} error={errors.street} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input label="Número" value={form.addressNumber} onChange={set('addressNumber')} error={errors.addressNumber} /><Input label="Complemento (opcional)" value={form.addressComplement} onChange={set('addressComplement')} /></div>
            <Input label="Bairro" value={form.neighborhood} onChange={set('neighborhood')} error={errors.neighborhood} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-2"><span className="text-xs font-semibold" style={{ color: '#9090a0' }}>Estado</span><select aria-invalid={Boolean(errors.state)} value={form.state} onChange={handleStateChange} className="w-full rounded-xl px-4" style={{ height: 48, background: '#141416', border: '1px solid rgba(255,255,255,.12)', color: '#f0f0f2' }}><option value="">Selecione</option>{states.map(state => <option key={state.id} value={state.sigla}>{state.nome} - {state.sigla}</option>)}</select>{errors.state && <span className="text-xs" style={{ color: '#ff6b7a' }}>{errors.state}</span>}</label>
              <label className="flex flex-col gap-2"><span className="text-xs font-semibold" style={{ color: '#9090a0' }}>Cidade</span><select aria-invalid={Boolean(errors.city)} value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} disabled={!form.state || loadingCities} className="w-full rounded-xl px-4 disabled:opacity-50" style={{ height: 48, background: '#141416', border: '1px solid rgba(255,255,255,.12)', color: '#f0f0f2' }}><option value="">{loadingCities ? 'Carregando...' : 'Selecione'}</option>{cities.map(city => <option key={city.id} value={city.nome}>{city.nome}</option>)}</select>{errors.city && <span className="text-xs" style={{ color: '#ff6b7a' }}>{errors.city}</span>}</label>
            </div>
          </>}

          {step===3&&<>
            <div className="mb-1"><h2 className="font-semibold" style={{color:'#f0f0f2'}}>Criar acesso</h2><p className="text-xs mt-1" style={{color:'#6b6b78'}}>Último passo. Crie sua senha para acessar pedidos, pagamentos e projetos.</p></div>
            <Input label="Senha" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} error={errors.password} />
            <Input label="Confirmar senha" type="password" autoComplete="new-password" placeholder="Repita a senha" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          </>}

          <div className="grid grid-cols-2 gap-3 mt-2">
            {step>1?<Button type="button" variant="secondary" fullWidth size="lg" onClick={previousStep}>Voltar</Button>:<div />}
            {step<3?<Button type="button" fullWidth size="lg" onClick={nextStep}>Continuar</Button>:<Button type="submit" fullWidth loading={loading} size="lg">Criar conta</Button>}
          </div>

          <p className="text-xs text-center" style={{ color: '#6b6b78' }}>
            Etapa {step} de 3 · Seus dados ficam salvos enquanto você avança.
          </p>
          {step===3&&<p className="text-xs text-center" style={{ color: '#6b6b78' }}>Ao criar uma conta, você concorda com os nossos termos de uso.</p>}
        </form>
      </div>
    </div>
  )
}
