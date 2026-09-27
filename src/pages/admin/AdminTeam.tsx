import { useEffect,useMemo,useState } from 'react'
import { portalApi } from '../../api/portal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { DEPARTMENT_LABELS,STAFF_PERMISSIONS,STAFF_PRESETS,type StaffDepartment } from '../../lib/staffPermissions'

type Draft={
  user_id:string
  first_name:string
  last_name:string
  email:string
  job_title:string
  department:StaffDepartment
  permissions:string[]
  active:boolean
}

const emptyDraft:Draft={
  user_id:'',
  first_name:'',
  last_name:'',
  email:'',
  job_title:'Colaborador',
  department:'custom',
  permissions:[],
  active:true,
}

function staffInfo(member:any){
  return Array.isArray(member.staff)?member.staff[0]:member.staff
}

export function AdminTeam(){
  const {user}=useAuth()
  const toast=useToast()
  const [profiles,setProfiles]=useState<any[]>([])
  const [team,setTeam]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [candidate,setCandidate]=useState('')
  const [mode,setMode]=useState<'existing'|'invite'>('existing')
  const [draft,setDraft]=useState<Draft>(emptyDraft)
  const [editing,setEditing]=useState<string|null>(null)
  const [saving,setSaving]=useState(false)

  async function load(){
    const [all,members]=await Promise.all([portalApi.allProfiles(),portalApi.teamMembers()])
    setProfiles(all);setTeam(members)
  }
  useEffect(()=>{void load()},[])

  const filtered=useMemo(()=>team.filter(member=>{
    const s=staffInfo(member)
    const text=[member.first_name,member.last_name,member.email,s?.job_title,DEPARTMENT_LABELS[s?.department as StaffDepartment]||''].join(' ').toLowerCase()
    return text.includes(search.toLowerCase())
  }),[team,search])

  const candidates=profiles.filter(profile=>profile.role==='customer'&&profile.status==='active')

  function applyPreset(department:StaffDepartment){
    setDraft(current=>({...current,department,permissions:[...STAFF_PRESETS[department]]}))
  }

  function togglePermission(permission:string){
    setDraft(current=>({...current,permissions:current.permissions.includes(permission)
      ?current.permissions.filter(item=>item!==permission)
      :[...current.permissions,permission]}))
  }

  function editMember(member:any){
    const s=staffInfo(member)
    setEditing(member.id)
    setDraft({
      user_id:member.id,
      first_name:member.first_name||'',
      last_name:member.last_name||'',
      email:member.email||'',
      job_title:s?.job_title||'Colaborador',
      department:(s?.department||'custom') as StaffDepartment,
      permissions:s?.permissions?.includes('*')?STAFF_PERMISSIONS.map(([permission])=>permission):s?.permissions||[],
      active:s?.active??true,
    })
  }

  function reset(){
    setEditing(null);setCandidate('');setDraft(emptyDraft);setMode('existing')
  }

  async function saveExisting(){
    if(!candidate&&!editing)return
    const userId=editing||candidate
    try{
      setSaving(true)
      await portalApi.saveCollaborator({
        user_id:userId,
        job_title:draft.job_title,
        department:draft.department,
        permissions:draft.permissions,
        active:draft.active,
      })
      await load()
      toast(editing?'Colaborador atualizado.':'Colaborador adicionado à equipe.','success')
      reset()
    }catch(error:any){toast(error.message||'Não foi possível salvar o colaborador.','error')}
    finally{setSaving(false)}
  }

  async function invite(){
    if(!draft.email.trim()||!draft.first_name.trim())return
    try{
      setSaving(true)
      const result=await portalApi.inviteCollaborator({
        email:draft.email.trim(),
        first_name:draft.first_name.trim(),
        last_name:draft.last_name.trim(),
        job_title:draft.job_title.trim()||'Colaborador',
        department:draft.department,
        permissions:draft.permissions,
      })
      await load()
      toast(result.invited?'Convite enviado e colaborador criado.':'Conta existente adicionada à equipe.','success')
      reset()
    }catch(error:any){toast(error.message||'Não foi possível convidar o colaborador.','error')}
    finally{setSaving(false)}
  }

  async function remove(member:any){
    if(!confirm('Remover '+(member.first_name||member.email)+' da equipe?'))return
    try{
      setSaving(true)
      const s=staffInfo(member)
      if(s){
        await portalApi.saveCollaborator({
          user_id:member.id,
          job_title:s.job_title||'Colaborador',
          department:(s.department||'custom') as StaffDepartment,
          permissions:s.permissions||[],
          active:false,
        })
      }
      await portalApi.setMemberRole(member.id,'customer')
      toast('Acesso de colaborador removido.','success')
      await load()
    }catch(error:any){toast(error.message||'Não foi possível remover o colaborador.','error')}
    finally{setSaving(false)}
  }

  if(user?.role!=='admin')return <div className="p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-100">Somente administradores gerenciam colaboradores e permissões.</div>

  return <div>
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[.18em] text-[#E30613] font-semibold">Gestão</p>
      <h1 className="text-2xl font-bold mt-1">Colaboradores</h1>
      <p className="text-sm text-gray-500 mt-1">Funções, áreas e acessos da equipe Play Moments.</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5"><div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Equipe</p><p className="text-xl font-bold mt-2">{team.length}</p></div><div className="p-4 rounded-2xl bg-[#141416] border border-white/10"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Ativos</p><p className="text-xl font-bold text-emerald-300 mt-2">{team.filter(m=>m.role==='admin'||staffInfo(m)?.active!==false).length}</p></div><div className="p-4 rounded-2xl bg-[#141416] border border-white/10 col-span-2 lg:col-span-1"><p className="text-[10px] uppercase tracking-[.12em] text-gray-500">Inativos</p><p className="text-xl font-bold text-gray-400 mt-2">{team.filter(m=>m.role!=='admin'&&staffInfo(m)?.active===false).length}</p></div></div>

    <div className="grid xl:grid-cols-[420px_1fr] gap-5">
      <section className="p-4 sm:p-5 rounded-2xl bg-[#141416] border border-white/10 h-fit">
        <div className="flex gap-2 mb-4">
          <button onClick={()=>{setMode('existing');setEditing(null)}} className={'min-h-10 px-3 rounded-xl text-xs '+(mode==='existing'?'bg-[#E30613] text-white':'bg-white/[0.05] text-gray-400')}>Conta existente</button>
          <button onClick={()=>{setMode('invite');setEditing(null);setCandidate('')}} className={'min-h-10 px-3 rounded-xl text-xs '+(mode==='invite'?'bg-[#E30613] text-white':'bg-white/[0.05] text-gray-400')}>Convidar por e-mail</button>
        </div>

        <h2 className="font-bold">{editing?'Editar colaborador':mode==='invite'?'Novo colaborador':'Adicionar conta cadastrada'}</h2>

        <div className="space-y-3 mt-4">
          {!editing&&mode==='existing'&&<select value={candidate} onChange={e=>setCandidate(e.target.value)} className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
            <option value="">Selecione uma conta</option>
            {candidates.map(profile=><option key={profile.id} value={profile.id}>{profile.first_name} {profile.last_name} — {profile.email}</option>)}
          </select>}

          {!editing&&mode==='invite'&&<>
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.first_name} onChange={e=>setDraft({...draft,first_name:e.target.value})} placeholder="Nome" className="min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
              <input value={draft.last_name} onChange={e=>setDraft({...draft,last_name:e.target.value})} placeholder="Sobrenome" className="min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
            </div>
            <input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="E-mail" className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </>}

          <input value={draft.job_title} onChange={e=>setDraft({...draft,job_title:e.target.value})} placeholder="Função: Comercial, Designer, Videomaker..." className="w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>

          <label className="block text-xs text-gray-500">Área / preset
            <select value={draft.department} onChange={e=>applyPreset(e.target.value as StaffDepartment)} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
              {Object.entries(DEPARTMENT_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-gray-500">Permissões</p>
              <button type="button" onClick={()=>setDraft({...draft,permissions:[]})} className="text-[10px] text-gray-500">Limpar</button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-white/8 bg-black/30 p-2 space-y-1">
              {STAFF_PERMISSIONS.map(([permission,label])=><label key={permission} className="flex gap-2 items-center min-h-9 px-2 rounded-lg hover:bg-white/[0.04] text-xs cursor-pointer">
                <input type="checkbox" checked={draft.permissions.includes(permission)} onChange={()=>togglePermission(permission)} className="accent-[#E30613]"/>
                <span>{label}</span>
              </label>)}
            </div>
          </div>

          {editing&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})} className="accent-[#E30613]"/> Colaborador ativo</label>}

          <div className="flex gap-2">
            <button disabled={saving||(!editing&&mode==='existing'&&!candidate)||(!editing&&mode==='invite'&&(!draft.email||!draft.first_name))} onClick={()=>void (mode==='invite'&&!editing?invite():saveExisting())} className="flex-1 min-h-11 rounded-xl bg-[#E30613] text-white text-sm font-semibold disabled:opacity-40">{saving?'Salvando...':editing?'Salvar alterações':mode==='invite'?'Enviar convite':'Adicionar à equipe'}</button>
            {editing&&<button onClick={reset} className="min-h-11 px-4 rounded-xl bg-white/[0.06] text-sm">Cancelar</button>}
          </div>
        </div>
      </section>

      <section>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar colaborador, função ou área..." className="w-full mb-4 min-h-11 px-4 rounded-xl bg-white/5 border border-white/10"/>
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map(member=>{
            const s=staffInfo(member)
            const admin=member.role==='admin'
            return <article key={member.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10">
              <div className="flex justify-between gap-3 items-start">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{member.first_name} {member.last_name}</p>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                </div>
                <span className={'px-2 py-1 rounded-full text-[10px] '+(admin?'bg-[#E30613]/15 text-[#ff5d68]':'bg-emerald-500/10 text-emerald-400')}>{admin?'Administrador':s?.active===false?'Inativo':'Colaborador'}</span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold">{admin?'Administrador':s?.job_title||'Colaborador'}</p>
                {!admin&&<p className="text-xs text-[#E30613] mt-1">{DEPARTMENT_LABELS[(s?.department||'custom') as StaffDepartment]}</p>}
                <p className="text-[10px] text-gray-600 mt-2">{admin?'Acesso total ao sistema':(s?.permissions?.includes('*')?'Acesso total legado':(s?.permissions?.length||0)+' permissões configuradas')}</p>
              </div>
              <div className="flex gap-2 mt-4">
                {!admin&&<button onClick={()=>editMember(member)} className="min-h-10 px-3 rounded-xl bg-white/[0.06] text-xs">Editar acessos</button>}
                {!admin&&<button disabled={saving} onClick={()=>void remove(member)} className="min-h-10 px-3 rounded-xl bg-red-500/10 text-red-400 text-xs">Remover</button>}
              </div>
            </article>
          })}
        </div>
      </section>
    </div>
  </div>
}
