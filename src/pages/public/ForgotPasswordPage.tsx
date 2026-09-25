import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'
import logoUrl from '../../assets/logo-play-moments.png'
export function ForgotPasswordPage(){
 const {resetPassword}=useAuth(),toast=useToast();const [email,setEmail]=useState(''),[loading,setLoading]=useState(false),[sent,setSent]=useState(false)
 async function submit(e:React.FormEvent){e.preventDefault();if(!email.trim())return;try{setLoading(true);await resetPassword(email);setSent(true);toast('Confira seu e-mail para redefinir a senha.','success')}catch(err:any){toast(err.message,'error')}finally{setLoading(false)}}
 return <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b]"><div className="w-full max-w-sm"><Link to="/"><img src={logoUrl} alt="Play Moments" style={{height:30}} className="mb-8"/></Link><h1 className="text-2xl font-bold">Recuperar senha</h1><p className="text-sm text-gray-500 mt-2 mb-6">Informe seu e-mail e enviaremos um link seguro.</p>{sent?<div className="p-5 rounded-2xl bg-[#141416] border border-white/10"><p className="font-semibold">E-mail enviado.</p><p className="text-sm text-gray-400 mt-2">Abra o link recebido para cadastrar uma nova senha.</p><Link to="/login" className="inline-block mt-4 text-[#E30613]">Voltar ao login</Link></div>:<form onSubmit={submit} className="space-y-4"><Input label="E-mail" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><Button type="submit" fullWidth loading={loading}>Enviar link de recuperação</Button><Link to="/login" className="block text-center text-sm text-gray-500">Voltar ao login</Link></form>}</div></div>
}