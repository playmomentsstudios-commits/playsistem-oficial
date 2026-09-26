import { useEffect,useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'

type ProfileForm={
  first_name:string;last_name:string;phone:string;document_number:string;postal_code:string;street:string
  address_number:string;address_complement:string;neighborhood:string;city:string;state:string
}

const empty:ProfileForm={first_name:'',last_name:'',phone:'',document_number:'',postal_code:'',street:'',address_number:'',address_complement:'',neighborhood:'',city:'',state:''}

export function ProfilePage(){
 const {user}=useAuth(),toast=useToast()
 const [loading,setLoading]=useState(false),[fetching,setFetching]=useState(true)
 const [form,setForm]=useState<ProfileForm>({...empty,first_name:user?.name||'',last_name:user?.lastName||'',phone:user?.phone||''})

 useEffect(()=>{if(!user)return
   let active=true
   supabase.from('profiles').select('first_name,last_name,phone,document_number,postal_code,street,address_number,address_complement,neighborhood,city,state').eq('id',user.id).single()
    .then(({data,error})=>{if(error)throw error;if(active&&data)setForm(Object.fromEntries(Object.entries({...empty,...data}).map(([k,v])=>[k,v??''])) as ProfileForm)})
    .catch((err:any)=>toast(err.message||'Não foi possível carregar seu perfil.','error'))
    .finally(()=>{if(active)setFetching(false)})
   return()=>{active=false}
 },[user?.id])

 function field(key:keyof ProfileForm){return (e:React.ChangeEvent<HTMLInputElement>)=>setForm(current=>({...current,[key]:e.target.value}))}
 async function save(e:React.FormEvent){
   e.preventDefault();if(!user)return;setLoading(true)
   try{
     const values=Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.trim()||null]))
     await portalApi.updateProfile(user.id,values)
     toast('Cadastro atualizado com sucesso.','success')
   }catch(err:any){toast(err.message||'Não foi possível atualizar o cadastro.','error')}finally{setLoading(false)}
 }
 if(fetching)return <div className="py-16 text-center text-sm text-gray-500">Carregando cadastro...</div>
 return <div className="max-w-3xl">
   <h1 className="text-2xl font-bold text-white mb-2">Meu Perfil</h1>
   <p className="text-sm text-gray-500 mb-6">Atualize seus dados de contato, cadastro e endereço.</p>
   <form onSubmit={save} className="space-y-6">
    <section className="p-5 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
      <h2 className="font-semibold">Dados pessoais</h2>
      <div className="grid sm:grid-cols-2 gap-3"><Input label="Nome" value={form.first_name} onChange={field('first_name')}/><Input label="Sobrenome" value={form.last_name} onChange={field('last_name')}/></div>
      <Input label="E-mail" value={user?.email||''} disabled/>
      <div className="grid sm:grid-cols-2 gap-3"><Input label="Telefone" value={form.phone} onChange={field('phone')}/><Input label="CPF/CNPJ (quando necessário)" value={form.document_number} onChange={field('document_number')}/></div>
    </section>
    <section className="p-5 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
      <div><h2 className="font-semibold">Endereço</h2><p className="text-xs text-gray-500 mt-1">Usado quando necessário para cadastro, pedido ou prestação do serviço.</p></div>
      <div className="grid sm:grid-cols-[160px_1fr] gap-3"><Input label="CEP" value={form.postal_code} onChange={field('postal_code')}/><Input label="Rua / Avenida" value={form.street} onChange={field('street')}/></div>
      <div className="grid sm:grid-cols-[140px_1fr] gap-3"><Input label="Número" value={form.address_number} onChange={field('address_number')}/><Input label="Complemento" value={form.address_complement} onChange={field('address_complement')}/></div>
      <Input label="Bairro" value={form.neighborhood} onChange={field('neighborhood')}/>
      <div className="grid sm:grid-cols-[1fr_100px] gap-3"><Input label="Cidade" value={form.city} onChange={field('city')}/><Input label="UF" value={form.state} onChange={field('state')}/></div>
    </section>
    <Button type="submit" loading={loading}>Salvar cadastro</Button>
   </form>
 </div>
}
