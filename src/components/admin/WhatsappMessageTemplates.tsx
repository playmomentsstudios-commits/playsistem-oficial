const TEMPLATES=[
 {title:'Projeto iniciado',icon:'🚀',body:'*Seu projeto começou!*\n\nO projeto *Identidade visual da marca* já está em andamento.\n\nAcompanhe: {{link_compacto_autenticado}}'},
 {title:'Etapa concluída',icon:'✅',body:'*Etapa concluída*\n\nA etapa *Conceito visual* do projeto *Identidade visual da marca* foi concluída.\n\nAcompanhe: {{link_compacto_autenticado}}'},
 {title:'Revisão disponível',icon:'🔎',body:'*Revisão disponível*\n\nO material *Apresentação da proposta* do projeto *Identidade visual da marca* está pronto para sua análise.\n\nAcompanhe: {{link_compacto_autenticado}}'},
 {title:'Ajustes concluídos',icon:'🛠️',body:'*Ajustes concluídos*\n\nA nova versão de *Apresentação da proposta* do projeto *Identidade visual da marca* está disponível.\n\nAcompanhe: {{link_compacto_autenticado}}'},
 {title:'Entrega final',icon:'🎉',body:'*Entrega final disponível*\n\nConcluímos o projeto *Identidade visual da marca*. Os materiais finais estão disponíveis.\n\nAcompanhe: {{link_compacto_autenticado}}'},
 {title:'Nova mensagem',icon:'💬',body:'*Nova mensagem no projeto*\n\nHá uma nova mensagem sobre *Identidade visual da marca*.\n\nAcompanhe: {{link_compacto_autenticado}}'},
]
export function WhatsappMessageTemplates(){
 return <section className="space-y-4" aria-label="Prévia dos modelos de WhatsApp">
  <header><h2 className="text-lg font-semibold text-white">Modelos de notificação</h2><p className="mt-1 text-xs text-gray-400">Prévia com dados de exemplo. O link é um campo de demonstração; o envio usa o destino autenticado da notificação.</p></header>
  <div className="grid gap-3 lg:grid-cols-2">
   {TEMPLATES.map(item=><article key={item.title} className="rounded-2xl border border-white/10 bg-[#141416] p-4">
    <h3 className="text-sm font-semibold text-white">{item.icon} {item.title}</h3>
    <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-[#0d0d0f] p-4 text-sm leading-relaxed text-gray-200">{item.body}</p>
   </article>)}
  </div>
 </section>
}
