import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'
export function ProfilePage(){
 const {user}=useAuth(),toast=useToast(); const [loading,setLoading]=useState(false)
 const [form,setForm]=useState({first_name:user?.name||'',last_name:user?.lastName||'',phone:user?.phone||''})
 async function save(e:React.FormEvent){e.preventDefault();if(!user)return;setLoading(true);try{await portalApi.updateProfile(user.id,{...form,phone:form.phone||null});toast('Perfil atualizado com sucesso.','success')}catch(err:any){toast(err.message,'error')}finally{setLoading(false)}}
 return <div><h1 className="text-2xl font-bold text-white mb-2">Meu Perfil</h1><p className="text-sm text-gray-500 mb-6">Atualize seus dados de contato</p><form onSubmit={save} className="max-w-xl space-y-4"><div className="grid grid-cols-2 gap-3"><Input label="Nome" value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/><Input label="Sobrenome" value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></div><Input label="E-mail" value={user?.email||''} disabled/><Input label="Telefone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><Button type="submit" loading={loading}>Salvar alterações</Button></form></div>
}