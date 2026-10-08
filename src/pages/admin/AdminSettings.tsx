import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { settingsApi,type AppSettings } from '../../api/settings'
import { useToast } from '../../contexts/ToastContext'

const DEFAULTS:AppSettings={
  id:true,
  business_name:'Sagamente',
  currency:'BRL',
  timezone:'America/Sao_Paulo',
  default_project_priority:'medium',
  default_quote_valid_days:7,
  default_client_file_visibility:false,
  drive_upload_limit_gb:50,
  crm_default_follow_up_days:2,
  orders_default_filter:'all',
  internal_operation_notifications:true,
  commercial_notifications:true,
  favicon_url:'/favicon.svg',
  staff_logo_url:'/staff-logo.svg',
  staff_platform_name:'Área do colaborador',
  staff_primary_color:'#A65A2A',
  staff_background_color:'#F4F6F8',
  staff_surface_color:'#FFFFFF',
  staff_text_color:'#17171A',
  updated_at:'',
  updated_by:null,
}

export function AdminSettings(){
  const toast=useToast()
  const [settings,setSettings]=useState<AppSettings>(DEFAULTS)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)

  useEffect(()=>{
    let active=true
    settingsApi.appSettings()
      .then(row=>{if(active&&row)setSettings(row)})
      .catch(error=>toast(error.message||'Não foi possível carregar as configurações.','error'))
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])

  async function save(){
    try{
      setSaving(true)
      const saved=await settingsApi.saveAppSettings({
        business_name:settings.business_name.trim()||'Sagamente',
        currency:settings.currency,
        timezone:settings.timezone,
        default_project_priority:settings.default_project_priority,
        default_quote_valid_days:Number(settings.default_quote_valid_days)||7,
        default_client_file_visibility:settings.default_client_file_visibility,
        drive_upload_limit_gb:Number(settings.drive_upload_limit_gb)||50,
        crm_default_follow_up_days:Number(settings.crm_default_follow_up_days)||2,
        orders_default_filter:settings.orders_default_filter,
        internal_operation_notifications:settings.internal_operation_notifications,
        commercial_notifications:settings.commercial_notifications,
        staff_platform_name:settings.staff_platform_name.trim()||'Área do colaborador',
        staff_primary_color:settings.staff_primary_color,
        staff_background_color:settings.staff_background_color,
        staff_surface_color:settings.staff_surface_color,
        staff_text_color:settings.staff_text_color,
      })
      setSettings(saved)
      toast('Configurações administrativas salvas.','success')
    }catch(error:any){toast(error.message||'Não foi possível salvar as configurações.','error')}
    finally{setSaving(false)}
  }

  if(loading)return <div className="py-16 text-center text-sm text-gray-500">Carregando configurações...</div>

  return <div className="max-w-5xl">
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#A65A2A] font-semibold">Sistema</p>
      <h1 className="text-2xl font-bold mt-1">Configurações Administrativas</h1>
      <p className="text-sm text-gray-500 mt-1">Defina padrões operacionais usados pelo painel.</p>
    </div>

    <div className="grid lg:grid-cols-2 gap-5">
      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Negócio</h2>
        <p className="text-xs text-gray-500 mt-1">Informações-base usadas nos módulos internos.</p>
        <div className="space-y-4 mt-5">
          <label className="block text-xs text-gray-500">Nome do negócio
            <input value={settings.business_name} onChange={e=>setSettings({...settings,business_name:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs text-gray-500">Moeda
              <select value={settings.currency} onChange={e=>setSettings({...settings,currency:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
                <option value="BRL">BRL — Real</option>
              </select>
            </label>
            <label className="block text-xs text-gray-500">Fuso horário
              <select value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
                <option value="America/Sao_Paulo">Brasil — Brasília</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">Plataforma dos colaboradores</h2><p className="text-xs text-gray-500 mt-1">Cores e nome exibido na área branca da equipe. A logo fica em Gestão do Site → Identidade da Marca.</p></div>
          <span className="text-[10px] uppercase tracking-[.12em] text-[#A65A2A]">Somente Admin Mestre</span>
        </div>
        <div className="space-y-4 mt-5">
            <label className="block text-xs text-gray-500">Nome exibido no painel
              <input value={settings.staff_platform_name} onChange={e=>setSettings({...settings,staff_platform_name:e.target.value})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
            </label>
            <Link to="/admin/site?tab=identidade" className="inline-flex items-center min-h-10 text-xs text-[#DFA269] hover:underline">Editar logo e favicon em Identidade da Marca ↗</Link>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {([
                ['staff_primary_color','Cor principal'],
                ['staff_background_color','Fundo da plataforma'],
                ['staff_surface_color','Cards e menu'],
                ['staff_text_color','Texto principal'],
              ] as const).map(([key,label])=><label key={key} className="text-xs text-gray-500">{label}
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-black px-2">
                  <input type="color" value={settings[key]} onChange={e=>setSettings({...settings,[key]:e.target.value})} className="w-9 h-10 bg-transparent border-0 p-0"/>
                  <input value={settings[key]} onChange={e=>setSettings({...settings,[key]:e.target.value})} className="min-w-0 flex-1 h-10 bg-transparent border-0 text-xs uppercase"/>
                </div>
              </label>)}
            </div>
            <p className="text-[10px] text-gray-600">Essas opções controlam identidade, fundo, superfícies, texto e destaque. Permissões de cada colaborador continuam sendo configuradas em Colaboradores.</p>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Projetos e orçamentos</h2>
        <p className="text-xs text-gray-500 mt-1">Valores usados como padrão ao criar novos registros.</p>
        <div className="space-y-4 mt-5">
          <label className="block text-xs text-gray-500">Prioridade padrão de projeto
            <select value={settings.default_project_priority} onChange={e=>setSettings({...settings,default_project_priority:e.target.value as AppSettings['default_project_priority']})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="block text-xs text-gray-500">Validade padrão do orçamento
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} max={90} value={settings.default_quote_valid_days} onChange={e=>setSettings({...settings,default_quote_valid_days:Number(e.target.value)})} className="w-28 min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
              <span className="text-xs text-gray-500">dias</span>
            </div>
          </label>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Arquivos</h2>
        <p className="text-xs text-gray-500 mt-1">Padrões da central de arquivos e Google Drive.</p>
        <div className="space-y-4 mt-5">
          <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
            <div><p className="text-sm font-medium">Novo arquivo visível ao cliente</p><p className="text-[10px] text-gray-500 mt-1">Usar visibilidade pública como padrão no upload administrativo.</p></div>
            <input type="checkbox" checked={settings.default_client_file_visibility} onChange={e=>setSettings({...settings,default_client_file_visibility:e.target.checked})} className="accent-[#A65A2A]"/>
          </label>
          <label className="block text-xs text-gray-500">Limite operacional do Google Drive
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} max={50} value={settings.drive_upload_limit_gb} onChange={e=>setSettings({...settings,drive_upload_limit_gb:Number(e.target.value)})} className="w-28 min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
              <span className="text-xs text-gray-500">GB por arquivo</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">O backend continua limitado ao teto técnico de 50 GB por arquivo.</p>
          </label>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">CRM e pedidos</h2>
        <p className="text-xs text-gray-500 mt-1">Padrões usados nas rotinas comercial e operacional.</p>
        <div className="space-y-4 mt-5">
          <label className="block text-xs text-gray-500">Prazo padrão para próxima ação no CRM
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} max={30} value={settings.crm_default_follow_up_days} onChange={e=>setSettings({...settings,crm_default_follow_up_days:Number(e.target.value)})} className="w-28 min-h-11 px-3 rounded-xl bg-black border border-white/10"/>
              <span className="text-xs text-gray-500">dias</span>
            </div>
          </label>
          <label className="block text-xs text-gray-500">Filtro inicial da tela de pedidos
            <select value={settings.orders_default_filter} onChange={e=>setSettings({...settings,orders_default_filter:e.target.value as AppSettings['orders_default_filter']})} className="mt-1 w-full min-h-11 px-3 rounded-xl bg-black border border-white/10">
              <option value="all">Todos</option><option value="awaiting_payment">Aguardando pagamento</option><option value="paid">Pago</option><option value="in_production">Em produção</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option>
            </select>
          </label>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Notificações operacionais</h2>
        <p className="text-xs text-gray-500 mt-1">Políticas globais para os gatilhos internos do sistema.</p>
        <div className="space-y-3 mt-5">
          <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
            <div><p className="text-sm font-medium">Avisos de operação</p><p className="text-[10px] text-gray-500 mt-1">Habilitar avisos internos de projetos, arquivos e pedidos.</p></div>
            <input type="checkbox" checked={settings.internal_operation_notifications} onChange={e=>setSettings({...settings,internal_operation_notifications:e.target.checked})} className="accent-[#A65A2A]"/>
          </label>
          <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.035] border border-white/8 cursor-pointer">
            <div><p className="text-sm font-medium">Avisos comerciais</p><p className="text-[10px] text-gray-500 mt-1">Habilitar avisos internos ligados a CRM, orçamento e vendas.</p></div>
            <input type="checkbox" checked={settings.commercial_notifications} onChange={e=>setSettings({...settings,commercial_notifications:e.target.checked})} className="accent-[#A65A2A]"/>
          </label>
        </div>
      </section>

      <section className="p-5 rounded-2xl bg-[#141416] border border-white/10">
        <h2 className="font-semibold">Segurança e gestão</h2>
        <p className="text-xs text-gray-500 mt-1">Atalhos para áreas administrativas sensíveis.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <a href="/admin/equipe" className="p-3 rounded-xl bg-white/[0.035] border border-white/8 hover:border-white/15">
            <p className="text-sm font-medium">Colaboradores</p><p className="text-[10px] text-gray-500 mt-1">Funções e permissões</p>
          </a>
          <a href="/admin/auditoria" className="p-3 rounded-xl bg-white/[0.035] border border-white/8 hover:border-white/15">
            <p className="text-sm font-medium">Auditoria</p><p className="text-[10px] text-gray-500 mt-1">Histórico de alterações</p>
          </a>
          <a href="/admin/relatorios" className="p-3 rounded-xl bg-white/[0.035] border border-white/8 hover:border-white/15">
            <p className="text-sm font-medium">Relatórios</p><p className="text-[10px] text-gray-500 mt-1">Indicadores operacionais</p>
          </a>
          <a href="/admin/site" className="p-3 rounded-xl bg-white/[0.035] border border-white/8 hover:border-white/15">
            <p className="text-sm font-medium">Site</p><p className="text-[10px] text-gray-500 mt-1">Conteúdo público</p>
          </a>
        </div>
      </section>
    </div>

    <div className="mt-5 flex items-center gap-3">
      <button disabled={saving} onClick={()=>void save()} className="min-h-11 px-5 rounded-xl bg-[#A65A2A] text-white text-sm font-semibold disabled:opacity-40">{saving?'Salvando...':'Salvar configurações'}</button>
      {settings.updated_at&&<span className="text-[10px] text-gray-600">Última atualização: {new Date(settings.updated_at).toLocaleString('pt-BR')}</span>}
    </div>
  </div>
}
