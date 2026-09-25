import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
export function AdminServices(){
 const {user}=useAuth(),toast=useToast(); const [rows,setRows]=useState<any[]>([]),[name,setName]=useState('')
 const load=()=>portalApi.services(true).then(setRows); useEffect(()=>{void load()},[])
 async function create(){if(!name.trim())return;try{await portalApi.saveService({name:name.trim(),slug:name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),description:'',price_type:'quote',active:true,featured:false,status:'published',created_by:user?.id});setName('');toast('Serviço criado.','success');await load()}catch(e:any){toast(e.message,'error')}}
 return <div><h1 className="text-2xl font-bold text-white mb-2">Serviços</h1><p className="text-sm text-gray-500 mb-6">Catálogo real de serviços</p><div className="flex gap-2 mb-5"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do serviço" className="px-3 py-2 rounded-lg bg-white/5 border border-white/10"/><button onClick={create} className="px-4 py-2 rounded-lg bg-[#E30613]">Criar</button></div><div className="space-y-2">{rows.map(s=><div key={s.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex justify-between"><div><b>{s.name}</b><p className="text-xs text-gray-500">{s.price_type} · {s.status}</p></div><button onClick={async()=>{await portalApi.saveService({active:!s.active},s.id);await load()}}>{s.active?'Desativar':'Ativar'}</button></div>)}</div></div>
}