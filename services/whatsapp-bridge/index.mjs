import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import makeWASocket, { DisconnectReason, useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import pino from 'pino'

const url=process.env.SUPABASE_URL?.trim()
const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const expectedPhone=process.env.SAGAMENTE_WHATSAPP_PHONE?.replace(/\D/g,'')
const authDir=resolve(process.env.SAGAMENTE_WHATSAPP_AUTH_DIR||'./.local/session')
if(!url||!key||!/^55\d{10,11}$/.test(expectedPhone||'')){
  throw new Error('Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SAGAMENTE_WHATSAPP_PHONE no .env local.')
}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const instanceId=randomUUID()
const logger=pino({level:'silent'})
let socket=null
let socketOpen=false
let currentPhone=null
let connectionStatus='offline'
let connecting=false
let busy=false
let lastReport=0
let lastQrData=null
let retryAt=0
let stopping=false
let authorizedInstance=false
let tickRunning=false

const wait=(milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds))
function digits(value){return String(value||'').replace(/\D/g,'')}
function phoneOfSocket(sock){
  return digits(String(sock?.user?.id||'').split('@')[0].split(':')[0])
}
async function invoke(name,params){
  const {data,error}=await db.rpc(name,params)
  if(error)throw new Error(name+': '+error.message)
  return data
}
async function report(status,qrData=null,phone=null,error=null){
  if(stopping&&status!=='offline')return false
  const accepted=await invoke('wa_bridge_worker_report',{
    p_instance:instanceId,p_status:status,p_qr:qrData,p_phone:phone,p_error:error?.slice(0,300)||null
  })
  if(!accepted){
    authorizedInstance=false
    console.error('[bridge] Existe outra instância ativa. Encerre a anterior antes de executar uma nova.')
    return false
  }
  authorizedInstance=true
  connectionStatus=status
  lastReport=Date.now()
  return true
}
async function closeSession(logout=false){
  const old=socket
  socket=null
  socketOpen=false
  currentPhone=null
  lastQrData=null
  retryAt=Date.now()+10000
  if(old){
    try{
      if(logout)await old.logout()
      else old.end(new Error('Sagamente bridge stopped'))
    }catch{}
    try{old.ws?.close()}catch{}
  }
  if(logout){
    try{await rm(authDir,{recursive:true,force:true})}catch{}
  }
}
async function connect(){
  if(connecting||socket||stopping)return
  connecting=true
  try{
    await mkdir(authDir,{recursive:true,mode:0o700})
    try{await chmod(authDir,0o700)}catch{}
    if(!await report('connecting'))return
    const {state,saveCreds}=await useMultiFileAuthState(authDir)
    if(stopping)return
    const sock=makeWASocket({
      auth:state,
      logger,
      browser:Browsers.ubuntu('Sagamente'),
      markOnlineOnConnect:false,
      syncFullHistory:false,
      connectTimeoutMs:30000
    })
    socket=sock
    sock.ev.on('creds.update',saveCreds)
    sock.ev.on('connection.update',async ({connection,qr,lastDisconnect})=>{
      if(socket!==sock||stopping)return
      try{
        if(qr){
          const data=await QRCode.toDataURL(qr,{type:'image/png',margin:3,width:320,errorCorrectionLevel:'M'})
          lastQrData=data
          if(await report('qr_ready',data)){
            console.log('[bridge] QR Code disponível na Central WhatsApp. Leia com o celular.')
          }
        }
        if(connection==='open'){
          const phone=phoneOfSocket(sock)
          if(phone!==expectedPhone){
            console.error('[bridge] A conta vinculada não corresponde ao número autorizado.')
            await report('error',null,null,'Número vinculado diferente do número permitido.')
            await closeSession(true)
            return
          }
          currentPhone=phone
          lastQrData=null
          socketOpen=true
          if(await report('connected',null,phone))console.log('[bridge] Número esperado conectado; envios permanecem sujeitos à ativação no painel.')
        }
        if(connection==='close'){
          const reason=lastDisconnect?.error?.output?.statusCode
          socket=null;socketOpen=false;currentPhone=null;lastQrData=null
          if(reason===DisconnectReason.loggedOut){
            await report('logged_out')
            await rm(authDir,{recursive:true,force:true}).catch(()=>{})
            console.warn('[bridge] Sessão desconectada pelo WhatsApp. Será necessário parear novamente.')
          }else{
            await report('offline',null,null,'Conexão interrompida; aguardando reconexão.')
          }
          retryAt=Date.now()+12000
        }
      }catch(err){
        console.error('[bridge] Erro de conexão:',err?.message||'erro inesperado')
      }
    })
  }catch(err){
    console.error('[bridge] Erro ao iniciar conexão:',err?.message||'erro inesperado')
    await report('error',null,null,String(err?.message||'Falha no pareamento').slice(0,200)).catch(()=>{})
    retryAt=Date.now()+15000
  }finally{
    connecting=false
  }
}
async function sendOne(){
  if(!socketOpen||!socket||busy||!authorizedInstance||currentPhone!==expectedPhone)return
  busy=true
  try{
    const job=await invoke('wa_bridge_claim',{p_instance:instanceId})
    if(!job)return
    let success=false
    let msgId=null
    let sendError=null
    try{
      if(!socketOpen||!socket)throw new Error('Sessão desconectada antes do envio.')
      const destination=digits(job.phone)
      if(!/^55\d{10,11}$/.test(destination))throw new Error('Telefone inválido.')
      const result=await socket.sendMessage(destination+'@s.whatsapp.net',{text:job.message})
      if(!result?.key?.id)throw new Error('WhatsApp não retornou identificador da mensagem.')
      msgId=String(result.key.id)
      success=true
      console.log('[bridge] Tentativa aceita pelo WhatsApp Web (entrega não confirmada).')
    }catch(err){
      sendError=String(err?.message||'Falha ao enviar').slice(0,250)
      console.error('[bridge] Envio não concluído:',sendError)
    }
    await invoke('wa_bridge_finish',{
      p_instance:instanceId,p_attempt:job.attempt_id,p_success:success,
      p_msg_id:msgId,p_error:sendError
    })
  }catch(err){
    console.error('[bridge] Falha na fila:',err?.message||'erro inesperado')
  }finally{busy=false}
}
async function tick(){
  if(tickRunning||stopping)return
  tickRunning=true
  try{
    const [stateResult,settingsResult]=await Promise.all([
      db.from('whatsapp_bridge_state').select('requested_mode').eq('id',true).single(),
      db.from('app_settings').select('wa_bridge_sender_phone,wa_bridge_auto_enabled').eq('id',true).single()
    ])
    if(stateResult.error)throw stateResult.error
    if(settingsResult.error)throw settingsResult.error
    if(settingsResult.data.wa_bridge_sender_phone!==expectedPhone){
      if(socket)await closeSession()
      await report('error',null,null,'Configure a mesma linha no painel e no .env da ponte.')
      return
    }
    const mode=stateResult.data.requested_mode
    if(mode!=='connect'){
      if(socket||socketOpen)await closeSession(mode==='disconnect')
      if(mode==='disconnect'&&!socket)await rm(authDir,{recursive:true,force:true}).catch(()=>{})
      if(connectionStatus!=='offline'||Date.now()-lastReport>30000)await report('offline')
      return
    }
    if(!socket&&!connecting&&Date.now()>=retryAt)await connect()
    if(socket&&!socketOpen&&connectionStatus==='qr_ready'&&lastQrData&&Date.now()-lastReport>12000){
      if(!await report('qr_ready',lastQrData))await closeSession()
    }
    if(socketOpen&&Date.now()-lastReport>12000){
      if(!await report('connected',null,currentPhone))await closeSession()
    }
    if(socketOpen&&settingsResult.data.wa_bridge_auto_enabled)await sendOne()
  }catch(err){
    console.error('[bridge] Falha no ciclo:',err?.message||'erro inesperado')
  }finally{tickRunning=false}
}
async function shutdown(){
  if(stopping)return
  stopping=true
  console.log('[bridge] Desligando o serviço de conexão.')
  await closeSession(false)
  await invoke('wa_bridge_worker_report',{
    p_instance:instanceId,p_status:'offline',p_qr:null,p_phone:null,p_error:null
  }).catch(()=>{})
  process.exit(0)
}
process.on('SIGINT',()=>void shutdown())
process.on('SIGTERM',()=>void shutdown())
process.on('unhandledRejection',err=>console.error('[bridge] Falha inesperada:',String(err).slice(0,150)))
console.log('[bridge] Serviço iniciado sem envios automáticos por padrão. Aguarde a solicitação de conexão no painel.')
await tick()
while(!stopping){
  await wait(4000)
  await tick()
}
