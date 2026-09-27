import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoUrl from '../assets/logo-play-moments.png'
import { portalApi } from '../api/portal'
import { hasStaffPermission } from '../lib/staffPermissions'

const iconPaths:Record<string,string>={
  dashboard:'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z',
  commercial:'M4 19V9l8-5 8 5v10H4Zm4 0v-6h8v6', customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75',
  crm:'M3 3v18h18M7 16l4-4 3 3 5-7', quote:'M6 2h9l5 5v15H6V2Zm8 0v6h6M9 13h6M9 17h6', orders:'M6 7V5a6 6 0 0 1 12 0v2M4 7h16l-1 15H5L4 7Z',
  operation:'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5', projects:'M3 7h7l2 2h9v11H3V7Z', productivity:'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', files:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6', conversations:'M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15Z',
  finance:'M3 6h18M5 6l2-3h10l2 3M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18', payments:'M3 6h18v12H3V6Zm0 4h18M7 15h3', reports:'M5 20V10m7 10V4m7 16v-7',
  catalog:'M20 13 13 20 4 11V4h7l9 9ZM8.5 8.5h.01', products:'M21 8 12 3 3 8l9 5 9-5Zm-18 5 9 5 9-5M3 18l9 5 9-5', services:'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-3 3-3-3 3-3Z', categories:'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  communication:'M4 4h16v13H8l-4 4V4Z', notifications:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4', announcements:'M3 11v2h4l9 5V6l-9 5H3Zm13-1 4-3v10l-4-3', community:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  academy:'M4 5h16v14H4V5Zm4 4 4 3 4-3v6l-4 3-4-3V9',
  management:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5-3.5a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L16 3h-4l-.4 3a8 8 0 0 0-1.7 1L7.5 6l-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z', team:'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6m3-3h-6', about:'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM3 22a9 9 0 0 1 18 0', site:'M3 5h18v14H3V5Zm0 4h18M7 7h.01M10 7h.01', settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5-3.5 2-1.5-2-3.5-2.4 1A8 8 0 0 0 16 6l-.4-3h-4L11 6a8 8 0 0 0-2 1L6.5 6l-2 3.5 2 1.5a8 8 0 0 0 0 2l-2 1.5 2 3.5L9 17a8 8 0 0 0 2 1l.5 3h4l.5-3a8 8 0 0 0 2-1l2.5 1 2-3.5-2-1.5a8 8 0 0 0 0-2Z', audit:'M12 3 4 6v5c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-3Zm-3 9 2 2 4-4'
}
function MenuIcon({name,size=17}:{name:string;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]||iconPaths.dashboard}/></svg>}

const MENU_GROUPS = [
  { label:'Comercial', icon:'commercial', items:[
    { label:'Clientes', href:'/admin/clientes', icon:'customers', permission:'customers.view' },{ label:'CRM Comercial', href:'/admin/crm', icon:'crm', permission:['customers.view','customers.manage'] },{ label:'Orçamentos', href:'/admin/orcamentos', icon:'quote', permission:['quotes.view','quotes.manage'] },{ label:'Pedidos', href:'/admin/pedidos', icon:'orders', permission:['sales.view','sales.manage'] },
  ]},
  { label:'Operação', icon:'operation', items:[
    { label:'Projetos', href:'/admin/projetos', icon:'projects', permission:['projects.view','projects.manage'] },{ label:'Produtividade', href:'/admin/produtividade', icon:'productivity', permission:['projects.view','projects.manage'] },{ label:'Arquivos', href:'/admin/arquivos', icon:'files', permission:['files.view','files.manage'] },{ label:'Conversas', href:'/admin/conversas', icon:'conversations', permission:['conversations.access','conversations.view_all'] },
  ]},
  { label:'Financeiro', icon:'finance', items:[{ label:'Pagamentos', href:'/admin/pagamentos', icon:'payments', permission:['payments.view','payments.manage'] },{ label:'Relatórios', href:'/admin/relatorios', icon:'reports', permission:'reports.view' }]},
  { label:'Catálogo', icon:'catalog', items:[{ label:'Produtos', href:'/admin/produtos', icon:'products', permission:['catalog.view','catalog.manage'] },{ label:'Serviços', href:'/admin/servicos', icon:'services', permission:['catalog.view','catalog.manage'] },{ label:'Categorias', href:'/admin/categorias', icon:'categories', permission:['catalog.view','catalog.manage'] }]},
  { label:'Academia', icon:'academy', items:[{ label:'Cursos e Conteúdos', href:'/admin/academia', icon:'academy', adminOnly:true }]},
  { label:'Comunicação', icon:'communication', items:[{ label:'Notificações', href:'/admin/notificacoes', icon:'notifications' },{ label:'Comunicados', href:'/admin/comunicados', icon:'announcements', permission:'community.manage' },{ label:'Comunidade', href:'/admin/comunidade', icon:'community', permission:'community.manage' }]},
  { label:'Gestão', icon:'management', items:[{ label:'Colaboradores', href:'/admin/equipe', icon:'team', adminOnly:true },{ label:'Quem Somos', href:'/admin/portfolio', icon:'about', permission:'site.manage' },{ label:'Site', href:'/admin/site', icon:'site', permission:'site.manage' },{ label:'Configurações', href:'/admin/configuracoes', icon:'settings', adminOnly:true },{ label:'Auditoria', href:'/admin/auditoria', icon:'audit', adminOnly:true }]},
]

export function AdminLayout() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 })
  const [staffPermissions,setStaffPermissions]=useState<string[]>([])
  const [openGroups,setOpenGroups]=useState<string[]>([])
  const [accountOpen,setAccountOpen]=useState(false)
  useEffect(() => {
    if (!user?.id) return
    const load = () => portalApi.unreadCounts(user.id).then(setCounts).catch(() => undefined)
    void load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [user?.id])

  useEffect(()=>{
    if(!user?.id||user.role!=='staff'){setStaffPermissions([]);return}
    portalApi.myStaffProfile().then(profile=>setStaffPermissions(profile?.permissions||[])).catch(()=>setStaffPermissions([]))
  },[user?.id,user?.role])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0b' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!user || !['admin', 'staff'].includes(user.role)) return <Navigate to="/app/dashboard" replace />

  const handleLogout = async () => { await logout(); navigate('/') }

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname === href || location.pathname.startsWith(href + '/')

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside style={{
      width: 248,
      background: '#0a0a0b',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      ...(mobile ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 } : {}),
    }}>
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between gap-3">
          <Link to="/admin" className="block">
            <img src={logoUrl} alt="Play Moments" className="h-12 w-auto object-contain" />
          </Link>
          {mobile && <button onClick={() => setSidebarOpen(false)} className="text-gray-600 hover:text-gray-300">✕</button>}
        </div>
      </div>

      <nav className="flex-1 px-3 pt-4 overflow-y-auto pb-5">
        <Link to="/admin" onClick={()=>setSidebarOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3 text-sm font-semibold transition-all" style={{background:isActive('/admin',true)?'rgba(227,6,19,0.14)':'transparent',color:isActive('/admin',true)?'#ff6b7a':'#a0a0ad',border:isActive('/admin',true)?'1px solid rgba(227,6,19,0.22)':'1px solid transparent'}}><span className="text-[#E30613]"><MenuIcon name="dashboard" /></span>Painel</Link>
        {MENU_GROUPS.map(group=>{
          const visibleItems=group.items.filter((item:any)=>{
            if(user?.role==='admin')return true
            if(item.adminOnly)return false
            return hasStaffPermission(user?.role,staffPermissions,item.permission)
          })
          if(!visibleItems.length)return null
          const groupActive=visibleItems.some((item:any)=>isActive(item.href))
          const open=openGroups.includes(group.label)||groupActive
          return <div key={group.label} className="mb-1.5">
            <button type="button" onClick={()=>setOpenGroups(current=>current.includes(group.label)?current.filter(value=>value!==group.label):[...current,group.label])} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-white/[0.025]" style={{color:groupActive?'#ff6b7a':'#9090a0',background:groupActive?'rgba(227,6,19,0.06)':'transparent'}}>
              <span className="text-[#E30613]"><MenuIcon name={group.icon} size={16} /></span><span>{group.label}</span><span className="ml-auto text-[10px] text-gray-600">{open?'−':'+'}</span>
            </button>
            {open&&<div className="ml-[18px] pl-3 border-l border-white/[0.07] mt-1 mb-2">{visibleItems.map((item:any)=>{
              const active=isActive(item.href)
              return <Link key={item.href} to={item.href} onClick={()=>setSidebarOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all hover:bg-white/[0.025]" style={{background:active?'rgba(227,6,19,0.12)':'transparent',color:active?'#ff6b7a':'#777784'}}>
                <span className={active?'text-[#ff5364]':'text-gray-600'}><MenuIcon name={item.icon} size={15} /></span><span className="truncate">{item.label}</span>
                {item.href==='/admin/conversas'&&counts.messages>0&&<span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[10px] flex items-center justify-center">{counts.messages}</span>}
                {item.href==='/admin/notificacoes'&&counts.notifications>0&&<span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[10px] flex items-center justify-center">{counts.notifications}</span>}
              </Link>
            })}</div>}
          </div>
        })}
      </nav>


    </aside>
  )

  return (
    <div className="min-h-screen flex" style={{ background: '#0d0d0f' }}>
      <div className="hidden md:flex flex-shrink-0" style={{ width: 248 }}>
        <Sidebar />
      </div>

      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="md:hidden" style={{ width: 248 }}><Sidebar mobile /></div>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ background: '#0a0a0b', borderColor: 'rgba(255,255,255,0.05)', minHeight: 56 }}>
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSidebarOpen(true)} style={{ color: '#9090a0' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="text-sm font-semibold" style={{ color: '#f0f0f2' }}>Play Moments</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/admin/conversas" aria-label="Mensagens" title="Mensagens" className="relative w-10 h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center justify-center">
              <MenuIcon name="conversations" size={17}/>
              {counts.messages>0&&<span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0a0a0b]">{counts.messages>99?'99+':counts.messages}</span>}
            </Link>
            <Link to="/admin/notificacoes" aria-label="Notificações" title="Notificações" className="relative w-10 h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center justify-center">
              <MenuIcon name="notifications" size={17}/>
              {counts.notifications>0&&<span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#E30613] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0a0a0b]">{counts.notifications>99?'99+':counts.notifications}</span>}
            </Link>
            <div className="relative">
              <button type="button" onClick={()=>setAccountOpen(v=>!v)} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 hover:bg-white/[0.05] transition-colors">
                <span className="w-8 h-8 rounded-lg bg-[#E30613] text-white text-xs font-bold flex items-center justify-center">{(user?.name||'A').trim().charAt(0).toUpperCase()}</span>
                <span className="hidden sm:block text-left"><span className="block text-xs font-semibold text-gray-200 max-w-[150px] truncate">{user?.name||'Administrador'}</span><span className="block text-[9px] text-gray-600">{user?.role==='admin'?'Administrador':'Equipe'}</span></span>
                <span className="text-gray-600 text-xs">⌄</span>
              </button>
              {accountOpen&&<><button aria-label="Fechar menu" onClick={()=>setAccountOpen(false)} className="fixed inset-0 z-40 cursor-default"/><div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-xl border border-white/10 bg-[#111113] p-1.5 shadow-2xl">
                <Link to="/admin/configuracoes" onClick={()=>setAccountOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-gray-300 hover:bg-white/[0.05]"><MenuIcon name="settings" size={15}/><span>Configurações</span></Link>
                <div className="my-1 border-t border-white/[0.07]"/>
                <button onClick={()=>{setAccountOpen(false);void handleLogout()}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-[#ff6573] hover:bg-[#E30613]/10"><span>↩</span><span>Sair</span></button>
              </div></>}
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
