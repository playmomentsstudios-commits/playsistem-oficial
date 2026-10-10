// Record WhatsApp acknowledgements independently of sendMessage() returning an ID.
// This does not read or store any message bodies.
export function attachDeliveryReceipts(sock,instanceId,invoke){
  const pending=new Map()
  async function flush(messageId){
    const entry=pending.get(messageId)
    if(!entry)return false
    try{
      const saved=await invoke('wa_bridge_record_receipt',{
        p_instance:instanceId,p_message_id:messageId,p_code:entry.code,p_note:entry.note||null
      })
      if(saved&&pending.get(messageId)===entry)pending.delete(messageId)
      return Boolean(saved)
    }catch(error){
      console.warn('[bridge] Confirmação WhatsApp pendente de registro:',String(error?.message||'').slice(0,100))
      return false
    }
  }
  function observe(id,code,note){
    if(typeof id!=='string'||id.length<8||![0,2,3,4,5].includes(code))return
    const prior=pending.get(id)
    if(!prior||code===0||code>prior.code){
      pending.set(id,{code,note})
    }
    if(pending.size>100)pending.delete(pending.keys().next().value)
    void flush(id)
  }
  sock.ev.on('messages.update',updates=>{
    for(const item of updates||[]){
      if(item.key?.fromMe!==true)continue
      const code=item.update?.status
      observe(item.key.id,code,code===0?'Servidor informou rejeição ou erro no envio':null)
    }
  })
  sock.ev.on('message-receipt.update',updates=>{
    for(const item of updates||[]){
      if(item.key?.fromMe!==true)continue
      const receipt=item.receipt
      observe(item.key.id,receipt?.readTimestamp?4:receipt?.receiptTimestamp?3:null,null)
    }
  })
  return {flush}
}
