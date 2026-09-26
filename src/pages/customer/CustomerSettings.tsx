import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { settingsApi,type UserPreferences } from '../../api/settings'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export function CustomerSettings(){
  const {user,updatePassword}=useAuth()
  const toast=useToast()
  const [prefs,setPrefs]=useState<UserPreferences|null>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [changingPassword,setChangingPassword]=useState(false)

  useEffect(()=>{
    let active=true
    settingsApi.userPreferences()
      .then(row=>{if(active)setPrefs(row)})
      .catch(error=>toast(error.message||'Não foi possível carregar suas configurações.','error'))
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])

  async function save(){
    if(!prefs)return
    try{
      setSaving(true)
      const saved=await settingsApi.saveUserPreferences({
        sidebar_expanded:prefs.sidebar_expanded,
        floating_chat_enabled:prefs.floating_chat_enabled,
      })
      setPrefs(saved)
      try{window.localStorage.setItem('playmoments.customer.sidebar',saved.sidebar_expanded?'expanded':'collapsed')}catch{}
      toast('Preferências salvas.','success')
    }catch(error:any){toast(error.message||'Não foi possível salvar suas preferências.','error')}
    finally{setSaving(false)}
  }

  async function changePassword(e:React.FormEvent){
    e.preventDefault()
    if(password.length<8)return toast('Use uma senha com pelo menos 8 caracteres.','error')
    if(password!==confirmPassword)return toast('As senhas não coincidem.','error')
    try{
      setChangingPassword(true)
      await updatePassword(password)
      setPassword('');setConfirmPassword('')
      toast('Senha atualizada com sucesso.','success')
    }catch(error:any){toast(error.message||'Não foi possível alterar a senha.','error')}
    finally{setChangingPassword(false)}
  }

  if(loading)return <div className="py-16 text-center text-sm text-gray-500">Carregando configurações...</div>

  return <div className="max-w-4xl">
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#E30613] font-semibold">Conta</p>
      <h1 className="text-2xl font-bold mt-1">Configurações</h1>
      <p className="text-sm text-gray-500 mt-1">Controle sua experiência no portal e a segurança da sua conta.</p>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Experiência do portal</h2>
        <p className="text-xs text-gray-500 mt-1">Preferências aplicadas quando você entrar na sua conta.</p>

        <div className="space-y-3 mt-5">
          <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
            <div><p className="text-sm font-medium">Menu lateral expandido</p><p className="text-[10px] text-gray-500 mt-1">Entrar no portal com os nomes das opções visíveis.</p></div>
            <input type="checkbox" checked={prefs?.sidebar_expanded??false} onChange={e=>setPrefs(current=>current?{...current,sidebar_expanded:e.target.checked}:current)} className="accent-[#E30613]"/>
          </label>

          <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
            <div><p className="text-sm font-medium">Chat flutuante</p><p className="text-[10px] text-gray-500 mt-1">Mostrar o atalho de conversa sobre as páginas do portal.</p></div>
            <input type="checkbox" checked={prefs?.floating_chat_enabled??true} onChange={e=>setPrefs(current=>current?{...current,floating_chat_enabled:e.target.checked}:current)} className="accent-[#E30613]"/>
          </label>
        </div>

        <button disabled={saving||!prefs} onClick={()=>void save()} className="mt-4 min-h-11 px-4 rounded-xl bg-[#E30613] text-white text-sm font-semibold disabled:opacity-40">{saving?'Salvando...':'Salvar preferências'}</button>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Dados da conta</h2>
        <p className="text-xs text-gray-500 mt-1">Seus dados principais ficam separados das preferências do sistema.</p>
        <div className="mt-5 p-3 rounded-xl bg-white/[0.035] border border-white/8">
          <p className="text-[10px] uppercase text-gray-600">Conta</p>
          <p className="text-sm font-medium mt-1">{user?.name} {user?.lastName}</p>
          <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
        </div>
        <Link to="/app/perfil" className="inline-flex mt-4 min-h-11 px-4 items-center rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold">Editar nome e telefone</Link>
      </section>

      <section className="lg:col-span-2 p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Segurança</h2>
        <p className="text-xs text-gray-500 mt-1">Altere sua senha de acesso ao portal.</p>
        <form onSubmit={changePassword} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 mt-5 items-end">
          <label className="text-xs text-gray-500">Nova senha
            <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <label className="text-xs text-gray-500">Confirmar nova senha
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <button disabled={changingPassword||!password||!confirmPassword} type="submit" className="min-h-11 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold disabled:opacity-40">{changingPassword?'Alterando...':'Alterar senha'}</button>
        </form>
      </section>
    </div>
  </div>
}
