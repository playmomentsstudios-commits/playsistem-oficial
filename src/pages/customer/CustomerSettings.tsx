import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { settingsApi,type UserPreferences } from '../../api/settings'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'
import { PushNotificationSettings } from '../../components/ui/PushNotificationSettings'

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

  function toggle(key:keyof UserPreferences){
    return (e:React.ChangeEvent<HTMLInputElement>)=>setPrefs(current=>current?{...current,[key]:e.target.checked}:current)
  }

  async function save(){
    if(!prefs)return
    try{
      setSaving(true)
      const saved=await settingsApi.saveUserPreferences({
        sidebar_expanded:prefs.sidebar_expanded,
        floating_chat_enabled:prefs.floating_chat_enabled,
        notify_portal:prefs.notify_portal,
        notify_email:prefs.notify_email,
        notify_project_updates:prefs.notify_project_updates,
        notify_file_updates:prefs.notify_file_updates,
        notify_commercial_updates:prefs.notify_commercial_updates,
        profile_contact_visible_to_team:prefs.profile_contact_visible_to_team,
      })
      setPrefs(saved)
      try{window.localStorage.setItem('playmoments.customer.sidebar',saved.sidebar_expanded?'expanded':'collapsed')}catch{}
      window.dispatchEvent(new CustomEvent('playmoments:preferences',{detail:saved}))
      toast('Configurações salvas.','success')
    }catch(error:any){toast(error.message||'Não foi possível salvar suas configurações.','error')}
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

  const option=(title:string,description:string,key:keyof UserPreferences)=>(
    <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
      <div><p className="text-sm font-medium">{title}</p><p className="text-[10px] text-gray-500 mt-1">{description}</p></div>
      <input type="checkbox" checked={Boolean(prefs?.[key])} onChange={toggle(key)} className="accent-[#A65A2A]"/>
    </label>
  )

  return <div className="max-w-5xl">
    <CompactPageHeader eyebrow="Conta" title="Configurações" description="Experiência, notificações, privacidade e segurança." />

    <div className="grid gap-3 lg:grid-cols-2">
      <section className="pm-compact-card">
        <h2 className="font-semibold">Experiência do portal</h2>
        <p className="text-xs text-gray-500 mt-1">Preferências aplicadas quando você entrar na sua conta.</p>
        <div className="space-y-2 mt-3">
          {option('Menu lateral expandido','Entrar no portal com os nomes das opções visíveis.','sidebar_expanded')}
          {option('Chat flutuante','Mostrar o atalho de conversa sobre as páginas do portal.','floating_chat_enabled')}
        </div>
      </section>

      <section className="pm-compact-card">
        <h2 className="font-semibold">Dados da conta</h2>
        <p className="text-xs text-gray-500 mt-1">Contato, cadastro e endereço ficam no seu perfil.</p>
        <div className="mt-5 p-3 rounded-xl bg-white/[0.035] border border-white/8">
          <p className="text-[10px] uppercase text-gray-600">Conta</p>
          <p className="text-sm font-medium mt-1">{user?.name} {user?.lastName}</p>
          <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
        </div>
        <Link to="/app/perfil" className="inline-flex mt-4 min-h-11 px-4 items-center rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold">Editar cadastro e endereço</Link>
      </section>

      <section className="pm-compact-card">
        <h2 className="font-semibold">Notificações</h2>
        <p className="text-xs text-gray-500 mt-1">Escolha quais comunicações deseja receber.</p>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-semibold">Avisos do aplicativo instalado</p>
          <PushNotificationSettings/>
        </div>
        <div className="space-y-2 mt-3">
          {option('Notificações no portal','Manter avisos dentro da sua conta.','notify_portal')}
          {option('Notificações por e-mail','Permitir comunicações transacionais por e-mail.','notify_email')}
          {option('Atualizações de projetos','Avisos relacionados ao andamento dos seus projetos.','notify_project_updates')}
          {option('Atualizações de arquivos','Avisos sobre novos arquivos, versões e aprovações.','notify_file_updates')}
          {option('Orçamentos e pedidos','Avisos relacionados a orçamento, pedido e fluxo comercial.','notify_commercial_updates')}
        </div>
      </section>

      <section className="pm-compact-card">
        <h2 className="font-semibold">Privacidade</h2>
        <p className="text-xs text-gray-500 mt-1">Controle o uso interno dos seus dados de contato.</p>
        <div className="space-y-2 mt-3">
          {option('Contato visível à equipe','Permitir que colaboradores autorizados vejam seus dados de contato para atendimento e execução dos serviços.','profile_contact_visible_to_team')}
        </div>
        <p className="text-[10px] text-gray-600 mt-3">Essa preferência não altera dados obrigatórios de pedidos, pagamentos ou registros necessários para executar serviços contratados.</p>
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

    <button disabled={saving||!prefs} onClick={()=>void save()} className="mt-5 min-h-11 px-5 rounded-xl bg-[#A65A2A] text-white text-sm font-semibold disabled:opacity-40">{saving?'Salvando...':'Salvar configurações'}</button>
  </div>
}
