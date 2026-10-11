// Experimental Baileys connection controller. NEVER route production messages here.
// Requires private bearer protection at Worker entry and explicit opt-in via secret flag.
// WhatsApp QR is sensitive: never log it or include in public diagnostics.
import makeWASocket, { Browsers, DisconnectReason } from "@whiskeysockets/baileys";
import { createEncryptedAuthState } from "./auth-store.js";
export class ExperimentalSessionController {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.socket=null;this.qr=null;this.status="idle";this.deadline=0;this.stopTimer=null;}
  async fetch(request){
    const route=new URL(request.url).pathname;
    const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
    if(route==="/controller-status"){
      return new Response(JSON.stringify({enabled:this.env.EXPERIMENTAL_PAIRING_ENABLED==="true",status:this.status,active:!!this.socket,qrAvailable:!!this.qr,productionMessagesEnabled:false}),{headers});
    }
    if(this.env.EXPERIMENTAL_PAIRING_ENABLED!=="true")return new Response(JSON.stringify({error:"experiment_disabled"}),{status:503,headers});
    if(route==="/qr"){
      if(this.deadline && Date.now()>=this.deadline){await this.stop();}
      if(request.method!=="GET")return new Response(null,{status:405});
      return new Response(JSON.stringify({status:this.status,qr:this.qr,expiresAt:this.deadline||null}),{headers});
    }
    if(route==="/stop"&&request.method==="POST"){
      await this.stop();return new Response(JSON.stringify({stopped:true}),{headers});
    }
    if(route==="/start"&&request.method==="POST"){
      if(this.socket)return new Response(JSON.stringify({error:"already_active"}),{status:409,headers});
      try{
        const {state,saveCreds}=await createEncryptedAuthState(this.ctx.storage,this.env.PROBE_AES_KEY_B64);
        this.qr=null;this.status="connecting";this.deadline=Date.now()+60000;
        const socket=makeWASocket({auth:state,printQRInTerminal:false,browser:Browsers.ubuntu("Sagamente Isolated Probe"),syncFullHistory:false,markOnlineOnConnect:false,logger:{level:"silent",child(){return this},trace(){},debug(){},info(){},warn(){},error(){},fatal(){}}});
        this.socket=socket;
        socket.ev.on("creds.update",()=>{void saveCreds().catch(()=>{this.status="storage-error";void this.stop();});});
        socket.ev.on("connection.update",update=>{
          if(this.socket!==socket)return;
          if(update.qr){this.qr=update.qr;this.status="awaiting-pairing";}
          if(update.connection==="open"){this.status="connected";this.qr=null;void this.stop();} // test-only: deliberately disconnect after pairing
          if(update.connection==="close"){this.status="disconnected";this.qr=null;void this.stop();}
        });
        this.stopTimer=setTimeout(()=>{void this.stop()},60000);
        return new Response(JSON.stringify({started:true,deadline:this.deadline,productionMessagesEnabled:false}),{headers});
      }catch(error){await this.stop();return new Response(JSON.stringify({error:"start_failed",errorType:error?.name||"Error"}),{status:500,headers});}
    }
    return new Response(JSON.stringify({error:"not_found"}),{status:404,headers});
  }
  async stop(){
    if(this.stopTimer){clearTimeout(this.stopTimer);this.stopTimer=null;}
    const old=this.socket;this.socket=null;this.qr=null;this.deadline=0;
    try{old?.end?.(new Error("Isolated probe timeout"))}catch{}
    this.status="stopped";
  }
}
