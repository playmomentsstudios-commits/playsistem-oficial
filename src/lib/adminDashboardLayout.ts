import { supabase } from './supabase'

/**
 * Personalização exclusivamente visual. Nunca utilizar esta preferência
 * para tomar decisões de autorização: o backend e o roteamento continuam
 * responsáveis por RLS, RBAC e acesso a conteúdos.
 */
export const DASHBOARD_SHORTCUTS = [
  { id:'clients', label:'Clientes', description:'Consultar e administrar', href:'/admin/clientes', icon:'users' },
  { id:'academy', label:'Academia', description:'Gestão de conteúdo', href:'/admin/academia', icon:'academy' },
  { id:'course-access', label:'Liberar curso', description:'Matrículas e permissões', href:'/admin/academia?section=courses', icon:'unlock' },
  { id:'library-access', label:'Liberar conteúdo', description:'E-books e audiobooks', href:'/admin/academia?section=library&action=access', icon:'unlock' },
  { id:'library', label:'E-books e áudios', description:'Cadastrar e editar', href:'/admin/academia?section=library', icon:'books' },
  { id:'site', label:'Configurar site', description:'Páginas, identidade e SEO', href:'/admin/site', icon:'globe' },
  { id:'projects', label:'Projetos', description:'Acompanhar execução', href:'/admin/projetos', icon:'folder' },
  { id:'services', label:'Serviços', description:'Catálogo de serviços para clientes', href:'/admin/servicos', icon:'briefcase' },
  { id:'tasks', label:'Tarefas', description:'Produtividade', href:'/admin/produtividade', icon:'check' },
  { id:'crm', label:'CRM', description:'Contatos e retornos', href:'/admin/crm', icon:'users' },
  { id:'quotes', label:'Orçamentos', description:'Propostas comerciais', href:'/admin/orcamentos', icon:'file' },
  { id:'payments', label:'Pagamentos', description:'Conferência financeira', href:'/admin/pagamentos', icon:'wallet' },
  { id:'files', label:'Arquivos', description:'Central de arquivos', href:'/admin/arquivos', icon:'folder' },
  { id:'messages', label:'Conversas', description:'Mensagens e suporte', href:'/admin/conversas', icon:'chat' },
  { id:'saga', label:'Saga · Central Operacional', description:'Assistente, WhatsApp e atendimento', href:'/admin/whatsapp', icon:'chat' },
  { id:'settings', label:'Configurações', description:'Preferências administrativas', href:'/admin/configuracoes', icon:'settings' },
] as const

export const DASHBOARD_WIDGETS = [
  { id:'quick-actions', label:'Acessos rápidos', description:'Funções utilizadas no dia a dia' },
  { id:'pending', label:'Precisa de atenção', description:'Alertas e retornos pendentes' },
  { id:'projects', label:'Em andamento', description:'Últimos projetos ativos' },
] as const

export const DASHBOARD_METRICS = [
  { id:'customers', label:'Clientes', href:'/admin/clientes' },
  { id:'activeProjects', label:'Projetos ativos', href:'/admin/projetos' },
  { id:'openQuotes', label:'Orçamentos abertos', href:'/admin/orcamentos' },
  { id:'pendingPayments', label:'Pagamentos pendentes', href:'/admin/pagamentos' },
  { id:'unread', label:'Mensagens', href:'/admin/conversas' },
  { id:'openOrders', label:'Pedidos ativos', href:'/admin/pedidos' },
  { id:'overdueActions', label:'Retornos atrasados', href:'/admin/crm' },
] as const

export type DashboardLayout = {
  shortcuts: string[]
  widgets: string[]
  metrics: string[]
}

const METADATA_KEY = 'sagamente_admin_dashboard_v1'
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  // Uma ação principal de cada grupo do menu: Comercial, Operação, Financeiro,
  // Catálogo, Academia, Comunicação e Gestão.
  shortcuts:['clients','projects','payments','services','academy','messages','site','saga'],
  widgets:['quick-actions','pending','projects'],
  metrics:['customers','activeProjects','pendingPayments','unread'],
}

// Ajusta apenas as combinações padrão de versões anteriores, sem sobrescrever
// seleções ou ordenações que a pessoa montou manualmente.
const PREVIOUS_DEFAULT_SHORTCUTS = ['clients','projects','payments','services','academy','messages','site']
const LEGACY_DEFAULT_SHORTCUTS = ['clients','course-access','library-access','library','site','projects']
const LEGACY_DEFAULT_WITHOUT_PROJECTS = ['clients','course-access','library-access','library','site']

function upgradeLegacyShortcuts(shortcuts:string[]):string[]{
  const isLegacy=(values:string[])=>shortcuts.length===values.length&&shortcuts.every((id,i)=>id===values[i])
  return isLegacy(PREVIOUS_DEFAULT_SHORTCUTS)||isLegacy(LEGACY_DEFAULT_SHORTCUTS)||isLegacy(LEGACY_DEFAULT_WITHOUT_PROJECTS)
    ? [...DEFAULT_DASHBOARD_LAYOUT.shortcuts]
    : shortcuts
}

function normalizeIds(value:unknown, valid:readonly string[], fallback:string[]):string[]{
  if(!Array.isArray(value))return [...fallback]
  const result:string[]=[]
  for(const id of value){
    if(typeof id==='string'&&valid.includes(id)&&!result.includes(id))result.push(id)
  }
  return result
}

export function normalizeDashboardLayout(value:unknown):DashboardLayout{
  const row=(value&&typeof value==='object'&&!Array.isArray(value)?value:{}) as Record<string,unknown>
  return {
    shortcuts:(()=>{
      const selected=upgradeLegacyShortcuts(normalizeIds(row.shortcuts,DASHBOARD_SHORTCUTS.map(x=>x.id),DEFAULT_DASHBOARD_LAYOUT.shortcuts))
      // Migração única para incluir a central nos painéis personalizados anteriores.
      // Depois de salvar, o usuário pode removê-la normalmente pelo editor.
      return row.shortcutsVersion===2 || selected.includes('saga') ? selected : [...selected,'saga']
    })(),
    widgets:normalizeIds(row.widgets,DASHBOARD_WIDGETS.map(x=>x.id),DEFAULT_DASHBOARD_LAYOUT.widgets),
    metrics:normalizeIds(row.metrics,DASHBOARD_METRICS.map(x=>x.id),DEFAULT_DASHBOARD_LAYOUT.metrics),
  }
}

export async function loadDashboardLayout():Promise<DashboardLayout>{
  const {data,error}=await supabase.auth.getUser()
  if(error)throw error
  if(!data.user)throw new Error('Faça login para carregar seu painel.')
  return normalizeDashboardLayout(data.user.user_metadata?.[METADATA_KEY])
}

export async function saveDashboardLayout(layout:DashboardLayout):Promise<DashboardLayout>{
  const normalized=normalizeDashboardLayout({...layout,shortcutsVersion:2})
  const {data,error}=await supabase.auth.updateUser({data:{[METADATA_KEY]:{...normalized,shortcutsVersion:2}}})
  if(error)throw error
  if(!data.user)throw new Error('Não foi possível confirmar as preferências salvas.')
  window.dispatchEvent(new Event('sagamente:dashboard-layout-updated'))
  return normalized
}
