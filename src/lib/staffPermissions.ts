export type StaffDepartment='commercial'|'design'|'video'|'audio'|'web'|'support'|'finance'|'operations'|'academy'|'secondary_admin'|'custom'

export const STAFF_PERMISSIONS=[
  ['customers.view','Clientes — visualizar'],
  ['customers.manage','Clientes — alterar status'],
  ['catalog.view','Catálogo — visualizar'],
  ['catalog.manage','Catálogo — editar produtos e categorias'],
  ['sales.view','Vendas — visualizar pedidos'],
  ['sales.manage','Vendas — atualizar pedidos'],
  ['quotes.view','Orçamentos — visualizar'],
  ['quotes.manage','Orçamentos — criar e editar'],
  ['conversations.access','Conversas — acessar atribuídas'],
  ['conversations.view_all','Conversas — visualizar todas'],
  ['conversations.manage','Conversas — status, prioridade e tags'],
  ['conversations.transfer','Conversas — transferir atendimento'],
  ['projects.view','Projetos — visualizar'],
  ['projects.manage','Projetos — editar'],
  ['files.view','Arquivos — visualizar'],
  ['files.manage','Arquivos — enviar, mover e excluir'],
  ['payments.view','Pagamentos — visualizar'],
  ['payments.manage','Pagamentos — revisar e editar'],
  ['reports.view','Relatórios — visualizar'],
  ['community.manage','Comunidade — gerenciar'],
  ['site.manage','Site — gerenciar conteúdo'],
  ['academy.view','Academia — visualizar'],
  ['academy.students.manage','Academia — secretaria e alunos'],
  ['academy.curriculum.manage','Academia — estrutura curricular e turmas'],
  ['academy.content.manage','Academia — cursos e conteúdo'],
  ['academy.documents.manage','Academia — documentos e certificação'],
  ['academy.programs.manage','Academia — programas e trilhas'],

] as const

export const DEPARTMENT_LABELS:Record<StaffDepartment,string>={
  commercial:'Comercial',
  design:'Design',
  video:'Videomaker',
  audio:'Áudio / Produção musical',
  web:'Web / Desenvolvimento',
  support:'Atendimento',
  finance:'Financeiro',
  operations:'Operações',
  academy:'Academia / Educação',
  secondary_admin:'Admin secundário',
  custom:'Personalizado',
}

export const STAFF_PRESETS:Record<StaffDepartment,string[]>={
  commercial:[
    'customers.view','catalog.view','catalog.manage',
    'sales.view','sales.manage','quotes.view','quotes.manage',
    'conversations.access','conversations.view_all','conversations.manage','conversations.transfer',
  ],
  design:[
    'customers.view','conversations.access','conversations.manage',
    'projects.view','projects.manage','files.view','files.manage',
  ],
  video:[
    'customers.view','conversations.access','conversations.manage',
    'projects.view','projects.manage','files.view','files.manage',
  ],
  audio:[
    'customers.view','conversations.access','conversations.manage',
    'projects.view','projects.manage','files.view','files.manage',
  ],
  web:[
    'customers.view','conversations.access','conversations.manage',
    'projects.view','projects.manage','files.view','files.manage','catalog.view',
  ],
  support:[
    'customers.view','conversations.access','conversations.view_all','conversations.manage','conversations.transfer',
    'quotes.view','sales.view',
  ],
  finance:[
    'customers.view','sales.view','quotes.view','payments.view','payments.manage','reports.view',
  ],
  operations:[
    'customers.view','customers.manage','catalog.view','sales.view','quotes.view',
    'conversations.access','conversations.view_all','conversations.manage','conversations.transfer',
    'projects.view','projects.manage','files.view','files.manage','payments.view','reports.view',
  ],
  academy:[
    'academy.view','academy.content.manage','academy.students.manage',
  ],
  // Acesso operacional amplo sem privilégios exclusivos do Admin Mestre.
  // Gestão de colaboradores/configurações é adminOnly no roteamento e o financeiro
  // fica fora deste preset por não receber payments.* nem reports.view.
  secondary_admin:[
    'customers.view','customers.manage','catalog.view','catalog.manage',
    'sales.view','sales.manage','quotes.view','quotes.manage',
    'conversations.access','conversations.view_all','conversations.manage','conversations.transfer',
    'projects.view','projects.manage','files.view','files.manage',
    'community.manage','site.manage',
    'academy.view','academy.students.manage','academy.curriculum.manage','academy.content.manage',
    'academy.documents.manage','academy.programs.manage',
  ],
  custom:[],
}

export function hasStaffPermission(role:string|undefined,permissions:string[]|undefined,permission?:string|string[]){
  if(role==='admin')return true
  if(!permission)return true
  const current=permissions||[]
  if(current.includes('*'))return true
  return (Array.isArray(permission)?permission:[permission]).some(item=>current.includes(item))
}
