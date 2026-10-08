import { useEffect,useState,type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { portalApi } from '../../api/portal'
import { hasStaffPermission } from '../../lib/staffPermissions'

export function AdminPermissionGate({permission,adminOnly=false,children}:{permission?:string|string[];adminOnly?:boolean;children:ReactNode}){
  const {user}=useAuth()
  const [permissions,setPermissions]=useState<string[]|null>(user?.role==='admin'?[]:null)

  useEffect(()=>{
    if(user?.role==='admin'){setPermissions([]);return}
    if(user?.role!=='staff'){setPermissions([]);return}
    let active=true
    portalApi.myStaffProfile().then(profile=>{if(active)setPermissions(profile?.permissions||[])}).catch(()=>{if(active)setPermissions([])})
    return()=>{active=false}
  },[user?.id,user?.role])

  if(user?.role==='admin')return <>{children}</>
  if(adminOnly)return <Denied/>
  if(permissions===null)return <div className="py-20 text-center text-sm text-gray-500">Carregando permissões...</div>
  if(!hasStaffPermission(user?.role,permissions,permission))return <Denied/>
  return <>{children}</>
}

function Denied(){
  return <div className="max-w-lg mx-auto mt-16 p-6 rounded-2xl border border-white/10 bg-[#141416] text-center">
    <div className="w-12 h-12 rounded-full bg-[#A65A2A]/10 text-[#A65A2A] mx-auto flex items-center justify-center text-xl">🔒</div>
    <h2 className="font-bold text-lg mt-4">Acesso não liberado</h2>
    <p className="text-sm text-gray-500 mt-2">Seu perfil de colaborador não possui permissão para este módulo. Um administrador pode ajustar seus acessos em Colaboradores.</p>
  </div>
}
