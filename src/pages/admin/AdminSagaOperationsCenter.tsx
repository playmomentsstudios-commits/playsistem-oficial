import { useState } from 'react'
import { AdminSagaAssistant } from './AdminSagaAssistant'
import { AdminWhatsappCenter } from './AdminWhatsappCenter'

type Section = 'saga' | 'whatsapp'

export function AdminSagaOperationsCenter() {
  const [section, setSection] = useState<Section>('saga')
  return <div className="space-y-5">
    <header className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#DFA269]">Comunicação e operação</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Saga · Central Operacional</h1>
      <p className="mt-1 text-sm text-gray-400">Assistente operacional, notificações e atendimento WhatsApp no mesmo espaço.</p>
      <nav aria-label="Áreas da Central Operacional" className="mt-5 flex flex-wrap gap-2">
        <button type="button" aria-pressed={section==='saga'} onClick={()=>setSection('saga')} className={'rounded-xl px-4 py-3 text-sm font-semibold '+(section==='saga'?'bg-[#A65A2A] text-white':'border border-white/15 text-gray-300')}>Saga · Assistente</button>
        <button type="button" aria-pressed={section==='whatsapp'} onClick={()=>setSection('whatsapp')} className={'rounded-xl px-4 py-3 text-sm font-semibold '+(section==='whatsapp'?'bg-[#A65A2A] text-white':'border border-white/15 text-gray-300')}>WhatsApp · Atendimento</button>
      </nav>
    </header>
    {section==='saga'?<AdminSagaAssistant/>:<AdminWhatsappCenter/>}
  </div>
}
