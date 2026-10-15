import { BrandImage } from '../../components/BrandImage'
import { useEffect, useState } from 'react'
import { formatCep, lookupCep, lookupStreetCeps, normalizePlace, type CepSuggestion } from '../../lib/addressLookup'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { afterAuthPath, authLink, safeReturnPath } from '../../lib/navigation'
import { EMAIL_FORMAT_HINT, isServerEmailFormatError, isValidSignupEmail, normalizeSignupEmail } from '../../lib/signupEmail'

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', lastName: '', email: '', phone: '', documentNumber: '', postalCode: '', street: '', addressNumber: '', addressComplement: '', neighborhood: '', city: '', state: '', password: '', confirm: '', whatsappUpdatesOptIn: false, marketingOptIn: false })
  const [loading, setLoading] = useState(false)
  const [states, setStates] = useState<Array<{ id: number; sigla: string; nome: string }>>([])
  const [cities, setCities] = useState<Array<{ id: number; nome: string }>>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [loadingStreetCep,setLoadingStreetCep]=useState(false)
  const [cepSuggestions,setCepSuggestions]=useState<CepSuggestion[]>([])
  const [cepStatus,setCepStatus]=useState('')
  const [unknownCep,setUnknownCep]=useState(false)
  const [withoutNumber,setWithoutNumber]=useState(false)
  const [acceptedConditions,setAcceptedConditions]=useState(false)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [registrationError,setRegistrationError]=useState('')
  const { register, user, isLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const next = safeReturnPath(new URLSearchParams(location.search).get('next'))
  useEffect(()=>{
    if(step===1&&errors.email){document.getElementById('register-email')?.focus()}
  },[step,errors.email])
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(setStates).catch(() => setStates([]))
  }, [])

  useEffect(() => {
    if (!form.state) { setCities([]); setLoadingCities(false); return }
    const controller=new AbortController()
    setCities([])
    setLoadingCities(true)
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + form.state + '/municipios?orderBy=nome',{signal:controller.signal})
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Falha ao listar cidades')))
      .then((rows:Array<{id:number;nome:string}>)=>{if(!controller.signal.aborted)setCities(rows)})
      .catch(()=>{if(!controller.signal.aborted)setCities([])})
      .finally(()=>{if(!controller.signal.aborted)setLoadingCities(false)})
    return ()=>controller.abort()
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
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  useEffect(()=>{
    const value=digits(form.postalCode)
    if(value.length!==8){setLoadingCep(false);return}
    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      setLoadingCep(true)
      setCepSuggestions([])
      try{
        const address=await lookupCep(value,controller.signal)
        if(controller.signal.aborted)return
        setForm(prev=>digits(prev.postalCode)===value?{
          ...prev,postalCode:formatCep(value),state:address.uf,city:address.localidade,
          street:address.logradouro||prev.street,neighborhood:address.bairro||prev.neighborhood,
        }:prev)
        setUnknownCep(false)
        setCepStatus('CEP localizado. Confira os dados antes de continuar.')
        setErrors(prev=>({...prev,postalCode:''}))
      }catch(error){
        if(controller.signal.aborted)return
        setCepStatus('Não encontramos esse CEP. Confira os números ou selecione estado e cidade.')
        setErrors(prev=>({...prev,postalCode:'CEP não localizado; revise ou marque “Não sei meu CEP”.'}))
      }finally{if(!controller.signal.aborted)setLoadingCep(false)}
    },350)
    return ()=>{window.clearTimeout(timer);controller.abort()}
  },[form.postalCode])

  // For street-based search the postal service may return multiple CEPs.
  // Never choose an arbitrary city's "main" CEP.
  useEffect(()=>{
    if(digits(form.postalCode).length===8||!form.state||!form.city||form.street.trim().length<3){
      setLoadingStreetCep(false)
      setCepSuggestions([])
      return
    }
    const controller=new AbortController()
    const selectedState=form.state, selectedCity=form.city,selectedStreet=form.street
    const timer=window.setTimeout(async()=>{
      setLoadingStreetCep(true)
      try{
        const matches=await lookupStreetCeps(selectedState,selectedCity,selectedStreet,controller.signal)
        if(controller.signal.aborted)return
        const neighborhood=form.neighborhood.trim()
        const inNeighborhood=neighborhood?matches.filter(item=>normalizePlace(item.bairro)===normalizePlace(neighborhood)):[]
        const list=inNeighborhood.length?inNeighborhood:matches
        if(list.length===1){
          const selected=list[0]
          setForm(prev=>prev.state===selectedState&&prev.city===selectedCity&&prev.street===selectedStreet&&digits(prev.postalCode).length!==8?{
            ...prev,postalCode:formatCep(selected.cep),neighborhood:prev.neighborhood||selected.bairro
          }:prev)
          setUnknownCep(false)
          setCepStatus('CEP sugerido pelo endereço. Confira se corresponde à sua localização.')
          setErrors(prev=>({...prev,postalCode:''}))
          setCepSuggestions([])
        }else setCepSuggestions(list.slice(0,8))
      }catch{if(!controller.signal.aborted)setCepSuggestions([])}
      finally{if(!controller.signal.aborted)setLoadingStreetCep(false)}
    },700)
    return ()=>{window.clearTimeout(timer);controller.abort()}
  },[form.state,form.city,form.street,form.neighborhood,form.postalCode])

  const handleStateChange=(event:React.ChangeEvent<HTMLSelectElement>)=>{
    const state=event.target.value
    setForm(prev=>({...prev,state,city:'',postalCode:''}))
    setCepSuggestions([])
    setCepStatus('')
    setErrors(prev=>({...prev,state:'',city:'',postalCode:''}))
  }

  const handleCityChange=(city:string)=>{
    setForm(prev=>({...prev,city,postalCode:''}))
    setCepSuggestions([])
    setCepStatus('')
    setErrors(prev=>({...prev,city:'',postalCode:''}))
  }

  const chooseCep=(item:CepSuggestion)=>{
    setForm(prev=>({...prev,postalCode:formatCep(item.cep),street:item.logradouro||prev.street,neighborhood:item.bairro||prev.neighborhood}))
    setUnknownCep(false)
    setCepSuggestions([])
    setCepStatus('CEP selecionado. Confira os dados e continue.')
    setErrors(prev=>({...prev,postalCode:''}))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name) errs.name = 'Informe o nome'
    if (!form.lastName) errs.lastName = 'Informe o sobrenome'
    if (!normalizeSignupEmail(form.email)) errs.email = 'Informe o e-mail'
    else if (!isValidSignupEmail(form.email)) errs.email = EMAIL_FORMAT_HINT
    if (!form.phone.replace(/\D/g, '')) errs.phone = 'Informe o telefone'
    if (form.whatsappUpdatesOptIn && ![10,11].includes(form.phone.replace(/\D/g, '').length)) errs.phone = 'Informe um WhatsApp válido com DDD para receber os avisos'
    const document = form.documentNumber.replace(/\D/g, '')
    if (![11, 14].includes(document.length)) errs.documentNumber = 'Informe um CPF ou CNPJ válido'
    if (!unknownCep && form.postalCode.replace(/\D/g, '').length !== 8) errs.postalCode = 'Informe o CEP ou marque “Não sei meu CEP”'
    if (!form.street.trim()) errs.street = 'Informe a rua ou avenida'
    if (!withoutNumber && !form.addressNumber.trim()) errs.addressNumber = 'Informe o número ou marque “Sem número”'
    if (!form.neighborhood.trim()) errs.neighborhood = 'Informe o bairro'
    if (!form.city.trim()) errs.city = 'Informe a cidade'
    if (form.state.trim().length !== 2) errs.state = 'Informe a UF'
    if (!form.password || form.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    if (form.password !== form.confirm) errs.confirm = 'As senhas não coincidem'
    if (!acceptedConditions) errs.acceptedConditions = 'Leia e aceite as condições essenciais do cadastro'
    return errs
  }

  const stepErrors = (targetStep: number) => {
    const all = validate()
    const keys = targetStep === 1
      ? ['name','lastName','email','phone','documentNumber']
      : targetStep === 2
        ? ['postalCode','street','addressNumber','neighborhood','city','state']
        : ['password','confirm','acceptedConditions']
    return Object.fromEntries(Object.entries(all).filter(([key]) => keys.includes(key)))
  }

  const nextStep = () => {
    const errs = stepErrors(step)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setRegistrationError('')
    if(step===1)setForm(prev=>({...prev,email:normalizeSignupEmail(prev.email)}))
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
    if (Object.keys(errs).length) {
      setErrors(errs)
      const invalidStep=Object.keys(stepErrors(1)).length?1:Object.keys(stepErrors(2)).length?2:3
      setStep(invalidStep)
      setRegistrationError('Revise os campos destacados antes de concluir o cadastro.')
      window.scrollTo({top:0,behavior:'smooth'})
      return
    }
    setRegistrationError('')
    setLoading(true)
    try {
      const result = await register({
        name: form.name,
        lastName: form.lastName,
        email: normalizeSignupEmail(form.email),
        phone: form.phone,
        documentNumber: form.documentNumber,
        postalCode: form.postalCode,
        street: form.street,
        addressNumber: withoutNumber ? 'S/N' : form.addressNumber,
        addressComplement: form.addressComplement,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
        password: form.password,
        whatsappUpdatesOptIn: form.whatsappUpdatesOptIn,
        marketingOptIn: form.marketingOptIn,
        acceptedConditions,
      }, next)

      if (result.requiresEmailConfirmation) {
        toast(next === '/carrinho' ? 'Conta criada. Confirme seu e-mail e volte para finalizar sua compra.' : 'Conta criada. Confira seu e-mail para confirmar o cadastro.', 'success')
        navigate(authLink('/login', next))
        return
      }

      toast(next === '/carrinho' ? 'Conta criada! Vamos continuar sua compra.' : 'Conta criada com sucesso!', 'success')
      navigate(afterAuthPath(next, 'customer'))
    } catch (err: unknown) {
      if(isServerEmailFormatError(err)){
        setErrors(prev=>({...prev,email:'O servidor não aceitou este e-mail. Verifique o endereço e tente novamente.'}))
        setRegistrationError('Não foi possível validar o e-mail. Corrija o endereço na primeira etapa; seus outros dados foram preservados.')
        setStep(1)
        window.scrollTo({top:0,behavior:'smooth'})
      }else{
        const message=err instanceof Error?err.message:'Erro ao criar conta.'
        setRegistrationError(message)
        toast('Não foi possível concluir o cadastro. Confira o aviso no formulário.','error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isLoading && user) return <Navigate to={afterAuthPath(next, user.role)} replace />

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0a0a0b' }}>
      <div className="w-full max-w-md">
        <Link to="/"><BrandImage variant="dark" alt="Sagamente" style={{ height: 28, marginBottom: 32 }} /></Link>

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

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {registrationError&&<div role="alert" className="rounded-xl border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm leading-6 text-red-200">{registrationError}</div>}
          {step===1&&<>
            <div className="mb-1"><h2 className="font-semibold" style={{color:'#f0f0f2'}}>Seus dados</h2><p className="text-xs mt-1" style={{color:'#6b6b78'}}>Informações básicas para identificar sua conta.</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome" autoComplete="given-name" placeholder="João" value={form.name} onChange={set('name')} error={errors.name} />
              <Input label="Sobrenome" autoComplete="family-name" placeholder="Silva" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
            </div>
            <Input id="register-email" label="E-mail" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" placeholder="seu@email.com" value={form.email} onChange={e=>{
              setForm(prev=>({...prev,email:e.target.value}))
              setErrors(prev=>({...prev,email:''}))
              setRegistrationError('')
            }} error={errors.email} />
            <Input label="Telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={e=>setForm(prev=>({...prev,phone:formatPhone(e.target.value)}))} error={errors.phone} />
            <Input label="CPF/CNPJ" inputMode="numeric" placeholder="CPF ou CNPJ" value={form.documentNumber} onChange={e=>setForm(prev=>({...prev,documentNumber:formatDocument(e.target.value)}))} error={errors.documentNumber} />
          </>}

          {step===2&&<>
            <div className="mb-1">
              <h2 className="font-semibold text-[#f0f0f2]">Seu endereço</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#a0a0a9]">O CEP localiza a cidade e o estado automaticamente. Você também pode informar seu endereço sem saber o CEP.</p>
            </div>
            <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-5" aria-label="Localização e endereço">
              <div>
                <Input label="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9}
                  value={form.postalCode} onChange={e=>{
                    setForm(prev=>({...prev,postalCode:formatCep(e.target.value)}))
                    setUnknownCep(false)
                    setCepStatus('')
                    setErrors(prev=>({...prev,postalCode:''}))
                  }}
                  error={errors.postalCode} hint={loadingCep?'Localizando CEP…':cepStatus||'Preenche estado, cidade, bairro e rua, quando disponíveis.'}/>
                <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" className="h-4 w-4 accent-[#A65A2A]" checked={unknownCep}
                    onChange={e=>{
                      const checked=e.target.checked
                      setUnknownCep(checked)
                      if(checked){setForm(prev=>({...prev,postalCode:''}));setCepStatus('');setErrors(prev=>({...prev,postalCode:''}))}
                    }}/>
                  Não sei meu CEP
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-semibold text-[#a0a0a9]">Estado</span>
                  <select value={form.state} onChange={handleStateChange} autoComplete="address-level1"
                    aria-invalid={Boolean(errors.state)} className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111113] px-3 text-sm text-white">
                    <option value="">Selecione seu estado</option>
                    {states.map(state=><option key={state.id} value={state.sigla}>{state.nome} ({state.sigla})</option>)}
                    {form.state&&!states.some(state=>state.sigla===form.state)&&<option value={form.state}>{form.state}</option>}
                  </select>
                  {errors.state&&<span role="alert" className="text-xs text-[#ff6b7a]">{errors.state}</span>}
                </label>
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-semibold text-[#a0a0a9]">Cidade</span>
                  {form.state&&!loadingCities&&cities.length===0?
                    <input type="text" value={form.city} autoComplete="address-level2" placeholder="Digite sua cidade"
                      onChange={e=>handleCityChange(e.target.value)}
                      className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111113] px-3 text-sm text-white"/>:
                    <select value={form.city} onChange={e=>handleCityChange(e.target.value)} autoComplete="address-level2" disabled={!form.state||loadingCities}
                      aria-invalid={Boolean(errors.city)}
                      className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111113] px-3 text-sm text-white disabled:opacity-50">
                      <option value="">{loadingCities?'Buscando cidades…':'Selecione sua cidade'}</option>
                      {cities.map(city=><option key={city.id} value={city.nome}>{city.nome}</option>)}
                      {form.city&&!cities.some(city=>normalizePlace(city.nome)===normalizePlace(form.city))&&<option value={form.city}>{form.city}</option>}
                    </select>}
                  {errors.city&&<span role="alert" className="text-xs text-[#ff6b7a]">{errors.city}</span>}
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Input label="Número" value={withoutNumber?'S/N':form.addressNumber}
                    onChange={set('addressNumber')} disabled={withoutNumber}
                    autoComplete="address-line2" placeholder="Ex.: 125" error={errors.addressNumber}/>
                  <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" className="h-4 w-4 accent-[#A65A2A]" checked={withoutNumber}
                      onChange={e=>{
                        setWithoutNumber(e.target.checked)
                        setErrors(prev=>({...prev,addressNumber:''}))
                      }}/>
                    Sem número (S/N)
                  </label>
                </div>
                <Input label="Bairro" autoComplete="address-level3" placeholder="Seu bairro"
                  value={form.neighborhood} onChange={set('neighborhood')} error={errors.neighborhood}/>
              </div>
              <Input label="Rua / Avenida / Endereço" autoComplete="address-line1" placeholder="Nome da rua, avenida ou localidade"
                value={form.street} onChange={set('street')} error={errors.street}/>
              {loadingStreetCep&&<p role="status" className="text-xs text-[#b5a296]">Procurando CEPs para este endereço…</p>}
              {cepSuggestions.length>0&&<section aria-label="Sugestões de CEP" className="rounded-xl border border-white/10 bg-[#101013] p-3">
                <p className="mb-2 text-xs font-semibold text-[#d4c1b5]">Encontramos mais de um CEP. Escolha o correspondente:</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {cepSuggestions.map(item=><button key={item.cep} type="button" onClick={()=>chooseCep(item)}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/10">
                    <strong className="mr-2 text-[#e9a573]">{formatCep(item.cep)}</strong>
                    {[item.logradouro,item.bairro,item.localidade].filter(Boolean).join(' · ')}
                  </button>)}
                </div>
              </section>}
              <Input label="Complemento (opcional)" autoComplete="address-line3" placeholder="Apartamento, lote, referência…"
                value={form.addressComplement} onChange={set('addressComplement')}/>
              <p className="text-[11px] leading-5 text-gray-500">Não existe um CEP principal garantido para todas as cidades. Se a busca não encontrar um CEP único, você poderá continuar sem ele informando seu endereço completo.</p>
            </section>
          </>}

          {step===3&&<>
            <div className="mb-1"><h2 className="font-semibold" style={{color:'#f0f0f2'}}>Criar acesso</h2><p className="text-xs mt-1" style={{color:'#6b6b78'}}>Último passo. Crie sua senha para acessar pedidos, pagamentos e projetos.</p></div>
            <Input label="Senha" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} error={errors.password} />
            <Input label="Confirmar senha" type="password" autoComplete="new-password" placeholder="Repita a senha" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
            <section aria-labelledby="communication-preferences-title" className="rounded-2xl border border-white/10 bg-[#141416] p-4">
              <h3 id="communication-preferences-title" className="text-sm font-semibold text-white">Como deseja acompanhar sua experiência?</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">Seu link de confirmação será enviado por e-mail, independentemente das opções abaixo.</p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#A65A2A]"
                  checked={form.whatsappUpdatesOptIn}
                  onChange={e=>setForm(prev=>({...prev,whatsappUpdatesOptIn:e.target.checked}))}/>
                <span className="text-sm text-gray-200">Quero receber avisos pelo WhatsApp.
                  <span className="mt-1 block text-xs leading-relaxed text-gray-400">Atualizações da minha conta, pedidos, projetos, materiais e treinamentos no telefone informado. Posso cancelar quando quiser.</span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#A65A2A]"
                  checked={form.marketingOptIn}
                  onChange={e=>setForm(prev=>({...prev,marketingOptIn:e.target.checked}))}/>
                <span className="text-sm text-gray-200">Quero conhecer novidades da Sagamente.
                  <span className="mt-1 block text-xs leading-relaxed text-gray-400">Receber informações sobre novos cursos, conteúdos, produtos e ofertas. Opção independente dos avisos de serviço.</span>
                </span>
              </label>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">Nenhuma opção é obrigatória para criar a conta. O WhatsApp utiliza integração experimental, sujeita à disponibilidade do serviço; os avisos essenciais continuam acessíveis no painel.</p>
            </section>
            <section className="rounded-xl border border-white/10 bg-[#151517] p-4" aria-labelledby="conditions-title">
            <h3 id="conditions-title" className="text-sm font-semibold text-gray-100">Condições essenciais do cadastro</h3>
            <details className="my-3 rounded-lg bg-black/20 p-3 text-xs text-gray-400">
              <summary className="cursor-pointer font-semibold text-[#e1b696]">Leia como sua conta funciona</summary>
              <p className="mt-2 leading-relaxed">Seu nome, e-mail, telefone e endereço são utilizados para criar e identificar sua conta, permitir acesso à plataforma e administrar seus pedidos, projetos e treinamentos. A confirmação do e-mail é necessária para ativar o acesso. Avisos essenciais ficam no painel e no e-mail; WhatsApp e novidades comerciais dependem das autorizações opcionais acima, que podem ser alteradas nas configurações.</p>
            </details>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={acceptedConditions} onChange={e=>{
                setAcceptedConditions(e.target.checked)
                setErrors(prev=>({...prev,acceptedConditions:''}))
              }} className="mt-1 h-4 w-4 shrink-0 accent-[#A65A2A]"/>
              <span className="text-xs leading-5 text-gray-200">Li e aceito as condições essenciais de cadastro e uso da minha conta. <span className="text-gray-400">(Obrigatório)</span></span>
            </label>
            {errors.acceptedConditions&&<p role="alert" className="mt-2 text-xs text-[#ff6b7a]">{errors.acceptedConditions}</p>}
          </section>
          </>}

          <div className="grid grid-cols-2 gap-3 mt-2">
            {step>1?<Button type="button" variant="secondary" fullWidth size="lg" onClick={previousStep}>Voltar</Button>:<div />}
            {step<3?<Button type="button" fullWidth size="lg" onClick={nextStep}>Continuar</Button>:<Button type="submit" fullWidth loading={loading} disabled={!acceptedConditions || loading} size="lg">Criar conta</Button>}
          </div>

          <p className="text-xs text-center" style={{ color: '#6b6b78' }}>
            Etapa {step} de 3 · Seus dados ficam salvos enquanto você avança.
          </p>
        </form>
      </div>
    </div>
  )
}
