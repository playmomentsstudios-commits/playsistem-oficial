import { useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'
import logoUrl from '../../assets/logo-play-moments.png'
export function ResetPasswordPage(){
 const {updatePassword}=useAuth(),toast=useToast(),navigate=useNavigate();const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[loading,setLoading]=useState(false)
 async function submit(e:React.FormEvent){e.preventDefault();if(password.length<8){toast('Use pelo menos 8 caracteres.','error');return}if(password!==confirm){toast('As senhas não coincidem.','error');return}try{setLoading(true);await updatePassword(password);toast('Senha atualizada com sucesso.','success');navigate('/login',{replace:true})}catch(err:any){toast(err.message,'error')}finally{setLoading(false)}}
 return <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b]"><div className="w-full max-w-sm"><Link to="/"><img src={logoUrl} alt="Play Moments" style={{height:30}} className="mb-8"/></Link><h1 className="text-2xl font-bold">Criar nova senha</h1><p className="text-sm text-gray-500 mt-2 mb-6">Escolha uma nova senha para sua conta.</p><form onSubmit={submit} className="space-y-4"><Input label="Nova senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/><Input label="Confirmar senha" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/><Button type="submit" fullWidth loading={loading}>Atualizar senha</Button></form></div></div>
}