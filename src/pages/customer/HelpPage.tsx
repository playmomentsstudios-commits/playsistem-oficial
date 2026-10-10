import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AutoAttendant } from '../../components/chat/AutoAttendant'
import { conversationsApi } from '../../api/conversations'
import { useAuth } from '../../contexts/AuthContext'
import { CompactPageHeader } from '../../components/ui/CompactWorkspace'

/** Quick answers and guided help live separately from the human conversation. */
export function HelpPage(){
  const navigate=useNavigate()
  const {user}=useAuth()
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')

  const contactTeam=async(summary:string)=>{
    if(!user?.id)throw new Error('Entre na sua conta para conversar com a equipe.')
    if(sending)return
    setSending(true)
    setError('')
    try{
      // The customer explicitly chose to forward the completed briefing/support form.
      // Reuse their existing authenticated conversation and preserve attachments/history.
      const conversationId=await conversationsApi.open()
      await conversationsApi.send(conversationId,user.id,summary,crypto.randomUUID())
      navigate('/app/conversas')
    }catch(cause){
      const message=cause instanceof Error?cause.message:'Não foi possível encaminhar seu pedido.'
      setError(message)
      throw cause
    }finally{
      setSending(false)
    }
  }

  return <div className="mx-auto w-full max-w-4xl pb-5">
    <CompactPageHeader eyebrow="Central de ajuda" title="Como podemos ajudar?"
      description="Dúvidas rápidas, orientação sobre projetos, arquivos, pagamentos e serviços."
      actions={<Link to="/app/conversas" className="pm-compact-tap rounded-lg bg-[#A65A2A] px-3 text-xs font-bold text-white">Abrir conversa →</Link>}/>
    {error&&<p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">{error}</p>}
    <section aria-label="Dúvidas frequentes e autoatendimento" className="overflow-hidden rounded-xl border border-white/10 bg-[#141416]">
      <AutoAttendant initialFlow="faq" onHuman={contactTeam} busy={sending}/>
    </section>
    <p className="mt-3 text-[11px] text-gray-500">Para enviar fotos, documentos, áudios ou acompanhar uma resposta, use a conversa direta com a equipe.</p>
  </div>
}
