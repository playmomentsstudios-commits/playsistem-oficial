import { useEffect,useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../contexts/ToastContext'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'

type ProfileForm={
  first_name:string;last_name:string;phone:string;document_number:string;postal_code:string;street:string
  address_number:string;address_complement:string;neighborhood:string;city:string;state:string
}

const empty:ProfileForm={first_name:'',last_name:'',phone:'',document_number:'',postal_code:'',street:'',address_number:'',address_complement:'',neighborhood:'',city:'',state:''}

export function ProfilePage(){
 const {user,refreshUser}=useAuth(),toast=useToast()
 const [loading,setLoading]=useState(false),[fetching,setFetching]=useState(true),[avatarLoading,setAvatarLoading]=useState(false),[avatarUrl,setAvatarUrl]=useState<string|null>(null)
 const [form,setForm]=useState<ProfileForm>({...empty,first_name:user?.name||'',last_name:user?.lastName||'',phone:user?.phone||''})

 useEffect(()=>{if(!user)return
   let active=true
   void (async()=>{
     try{
       const {data,error}=await supabase.from('profiles').select('first_name,last_name,phone,document_number,postal_code,street,address_number,address_complement,neighborhood,city,state,avatar_url').eq('id',user.id).single()
       if(error)throw error
       if(active&&data){setAvatarUrl(data.avatar_url||null);const {avatar_url:_,...profileData}=data;setForm(Object.fromEntries(Object.entries({...empty,...profileData}).map(([k,v])=>[k,v??''])) as ProfileForm)}
     }catch(err:any){toast(err.message||'Não foi possível carregar seu perfil.','error')}
     finally{if(active)setFetching(false)}
   })()
   return()=>{active=false}
 },[user?.id])

 function field(key:keyof ProfileForm){return (e:React.ChangeEvent<HTMLInputElement>)=>setForm(current=>({...current,[key]:e.target.value}))}
 async function uploadAvatar(file:File){
   if(!user)return
   if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){toast('Use uma imagem JPG, PNG, WEBP ou AVIF.','error');return}
   if(file.size>5*1024*1024){toast('A imagem deve ter no máximo 5 MB.','error');return}
   setAvatarLoading(true)
   try{
     const ext=(file.name.split('.').pop()||'jpg').toLowerCase()
     const path=user.id+'/avatar-'+Date.now()+'.'+ext
     const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{upsert:false,contentType:file.type})
     if(uploadError)throw uploadError
     const {data:publicData}=supabase.storage.from('avatars').getPublicUrl(path)
     const previous=avatarUrl
     const {error:updateError}=await supabase.from('profiles').update({avatar_url:publicData.publicUrl}).eq('id',user.id)
     if(updateError){await supabase.storage.from('avatars').remove([path]);throw updateError}
     setAvatarUrl(publicData.publicUrl)
     await refreshUser()
     if(previous){
       const marker='/storage/v1/object/public/avatars/'
       const oldPath=previous.includes(marker)?decodeURIComponent(previous.split(marker)[1]):null
       if(oldPath?.startsWith(user.id+'/'))await supabase.storage.from('avatars').remove([oldPath])
     }
     toast('Foto de perfil atualizada.','success')
   }catch(err:any){toast(err.message||'Não foi possível atualizar a foto.','error')}
   finally{setAvatarLoading(false)}
 }
 async function removeAvatar(){
   if(!user||!avatarUrl)return
   setAvatarLoading(true)
   try{
     const previous=avatarUrl
     const {error}=await supabase.from('profiles').update({avatar_url:null}).eq('id',user.id)
     if(error)throw error
     setAvatarUrl(null)
     await refreshUser()
     const marker='/storage/v1/object/public/avatars/'
     const oldPath=previous.includes(marker)?decodeURIComponent(previous.split(marker)[1]):null
     if(oldPath?.startsWith(user.id+'/'))await supabase.storage.from('avatars').remove([oldPath])
     toast('Foto de perfil removida.','success')
   }catch(err:any){toast(err.message||'Não foi possível remover a foto.','error')}
   finally{setAvatarLoading(false)}
 }
 async function save(e:React.FormEvent){
   e.preventDefault();if(!user)return;setLoading(true)
   try{
     const nullable=(value:string)=>value.trim()||null
     const {error}=await supabase.from('profiles').update({
       first_name:form.first_name.trim(),
       last_name:form.last_name.trim(),
       phone:nullable(form.phone),
       document_number:nullable(form.document_number),
       postal_code:nullable(form.postal_code),
       street:nullable(form.street),
       address_number:nullable(form.address_number),
       address_complement:nullable(form.address_complement),
       neighborhood:nullable(form.neighborhood),
       city:nullable(form.city),
       state:nullable(form.state),
     }).eq('id',user.id)
     if(error)throw error
     await refreshUser()
     toast('Cadastro atualizado com sucesso.','success')
   }catch(err:any){toast(err.message||'Não foi possível atualizar o cadastro.','error')}finally{setLoading(false)}
 }
 if(fetching)return <div className="py-16 text-center text-sm text-gray-500">Carregando cadastro...</div>
 return <div className="max-w-3xl">
   <CompactPageHeader title="Meu Perfil" description="Dados pessoais, contato e endereço." />
   <form onSubmit={save} className="space-y-3">
    <section className="pm-compact-card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
          {avatarUrl?<img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover"/>:<span className="text-2xl font-bold text-gray-500">{(form.first_name?.[0]||user?.email?.[0]||'?').toUpperCase()}</span>}
        </div>
        <div>
          <h2 className="font-semibold">Foto de perfil</h2>
          <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP ou AVIF. Máximo de 5 MB.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <label className={'inline-flex min-h-10 items-center px-4 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold cursor-pointer '+(avatarLoading?'opacity-50 pointer-events-none':'')}>
              {avatarLoading?'Processando...':avatarUrl?'Trocar foto':'Enviar foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" disabled={avatarLoading} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAvatar(file);e.currentTarget.value='' }}/>
            </label>
            {avatarUrl&&<button type="button" disabled={avatarLoading} onClick={()=>void removeAvatar()} className="min-h-10 px-4 rounded-xl border border-red-500/20 text-red-400 text-sm disabled:opacity-50">Remover</button>}
          </div>
        </div>
      </div>
    </section>
    <section className="pm-compact-card space-y-4">
      <h2 className="font-semibold">Dados pessoais</h2>
      <div className="grid sm:grid-cols-2 gap-3"><Input label="Nome" value={form.first_name} onChange={field('first_name')}/><Input label="Sobrenome" value={form.last_name} onChange={field('last_name')}/></div>
      <Input label="E-mail" value={user?.email||''} disabled/>
      <div className="grid sm:grid-cols-2 gap-3"><Input label="Telefone" value={form.phone} onChange={field('phone')}/><Input label="CPF/CNPJ (quando necessário)" value={form.document_number} onChange={field('document_number')}/></div>
    </section>
    <section className="pm-compact-card space-y-4">
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
