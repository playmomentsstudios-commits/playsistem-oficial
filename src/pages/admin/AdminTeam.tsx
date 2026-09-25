import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export function AdminTeam(){
  const {user}=useAuth()
  const toast=useToast()
  const [profiles,setProfiles]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [candidate,setCandidate]=useState('')

  const load=async()=>setProfiles(await portalApi.allProfiles())
  useEffect(()=>{void load()},[])

  const team=useMemo(()=>profiles.filter(p=>['admin','staff'].includes(p.role)&&((p.first_name||'')+' '+(p.last_name||'')+' '+p.email).toLowerCase().includes(search.toLowerCase())),[profiles,search])
  const candidates=profiles.filter(p=>p.role==='customer'&&p.status==='active')

  async function changeRole(id:string,role:'customer'|'staff'|'admin'){
    try{
      await portalApi.setMemberRole(id,role)
      toast('Permissão atualizada.','success')
      await load()
    }catch(error:any){toast(error.message,'error')}
  }

  async function add(){
    if(!candidate)return
    await changeRole(candidate,'staff')
    setCandidate('')
  }

  return <div>
    <div className="mb-6">
      <h1 className="text-2xl font-bold">Equipe</h1>
      <p className="text-sm text-gray-500">Controle quem acessa o painel administrativo</p>
    </div>

    {user?.role==='admin'?<div className="p-5 rounded-2xl bg-[#141416] border border-white/10 mb-5">
      <h2 className="font-bold">Adicionar membro existente</h2>
      <p className="text-sm text-gray-500 mt-1">Como estamos mantendo o sistema sem serviço de convite pago, a pessoa cria uma conta normalmente e depois você promove essa conta para Equipe.</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <select value={candidate} onChange={e=>setCandidate(e.target.value)} className="min-w-64 px-3 py-2 rounded-xl bg-black border border-white/10">
          <option value="">Selecione uma conta cadastrada</option>
          {candidates.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name} — {p.email}</option>)}
        </select>
        <button onClick={add} disabled={!candidate} className="px-4 py-2 rounded-xl bg-[#E30613] disabled:opacity-40">Adicionar à equipe</button>
      </div>
    </div>:<div className="p-4 mb-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-200">Somente administradores podem alterar permissões da equipe.</div>}

    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar membro..." className="mb-4 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10"/>

    <div className="space-y-2">{team.map(member=><div key={member.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex flex-wrap justify-between gap-4 items-center">
      <div><p className="font-semibold">{member.first_name} {member.last_name}</p><p className="text-xs text-gray-500">{member.email}</p><p className="text-xs text-gray-600 mt-1">{member.status==='active'?'Ativo':'Inativo'}</p></div>
      <div className="flex items-center gap-2">
        <select disabled={user?.role!=='admin'||member.id===user?.id} value={member.role} onChange={e=>changeRole(member.id,e.target.value as 'customer'|'staff'|'admin')} className="px-3 py-2 rounded-xl bg-black border border-white/10 disabled:opacity-50">
          <option value="staff">Equipe</option>
          <option value="admin">Administrador</option>
          <option value="customer">Remover da equipe</option>
        </select>
      </div>
    </div>)}</div>
  </div>
}
