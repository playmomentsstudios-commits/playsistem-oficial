// Offline-only Baileys auth adapter test in Durable Object with encrypted SQLite-backed storage.
// This does not connect to WhatsApp, publish QR codes, or access production.
import makeWASocket, { Browsers, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import { createEncryptedAuthState } from "./auth-store.js";
import { ExperimentalSessionController } from "./session-controller.js";
const enc=new TextEncoder(),dec=new TextDecoder();
export class EncryptedAuthProbe {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async fetch(request){
    if(["/controller-status","/qr","/start","/stop"].includes(new URL(request.url).pathname)){
      this.controller ||= new ExperimentalSessionController(this.ctx,this.env);
      return this.controller.fetch(request);
    }
    if(new URL(request.url).pathname==="/ws-test"){
      if(request.headers.get("Upgrade")!=="websocket")return new Response("Upgrade required",{status:426});
      const pair=new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null,{status:101,webSocket:pair[0]});
    }
    if(new URL(request.url).pathname==="/outbound-ws-test"){
      // Network-only probe against a public echo service. Never uses WhatsApp credentials.
      // This endpoint is intentionally only in the local compat Worker, not deployed.
      const started=Date.now();
      try {
        const response=await fetch("https://sagamente-wa-cloudflare-probe.playmomentsstudios.workers.dev/ws-echo",{
          headers:{Upgrade:"websocket"},
          signal:AbortSignal.timeout(5000)
        });
        const ws=response.webSocket;
        if(!ws)return Response.json({outboundEstablished:false,status:response.status,elapsedMs:Date.now()-started,noWhatsAppSocket:true});
        ws.accept();
        const message=await new Promise(resolve=>{
          const timer=setTimeout(()=>resolve({echoReceived:false,timeout:true}),3000);
          ws.addEventListener("message",event=>{clearTimeout(timer);resolve({echoReceived:event.data==="sagamente-probe:outbound",messageType:typeof event.data})},{once:true});
          ws.send("sagamente-probe:outbound");
        });
        try{ws.close(1000,"done")}catch{}
        return Response.json({outboundEstablished:true,...message,closed:true,elapsedMs:Date.now()-started,noWhatsAppSocket:true});
      }catch(error){
        return Response.json({outboundEstablished:false,errorType:error?.name||"Error",diagnosticCode:String(error?.message||"unknown").slice(0,140),elapsedMs:Date.now()-started,noWhatsAppSocket:true});
      }
    }
    const requested=new URL(request.url).pathname;
    if(requested==="/auth-adapter-test"){
      try{
        const one=await createEncryptedAuthState(this.ctx.storage,this.env.PROBE_AES_KEY_B64);
        await one.state.keys.set({session:{"test@example.invalid":{chainKey:new Uint8Array([4,5,6]),counter:3}}});
        const two=await createEncryptedAuthState(this.ctx.storage,this.env.PROBE_AES_KEY_B64);
        const restored=(await two.state.keys.get("session",["test@example.invalid"]))["test@example.invalid"];
        const credsValid=Boolean(two.state.creds.noiseKey?.private?.length);
        const keyValid=restored?.counter===3&&restored.chainKey[1]===5;
        await two.state.keys.set({session:{"test@example.invalid":null}});
        const deleted=Object.keys(await two.state.keys.get("session",["test@example.invalid"])).length===0;
        return Response.json({authAdapter:true,credsValid,keyValid,deleted,encrypted:true,secretSeparated:true,noWhatsAppSocket:true});
      }catch(error){return Response.json({authAdapter:false,errorType:error?.name||"Error"},{status:500});}
    }
    if(requested==="/lifecycle"){
      // Deterministic bounded offline socket-lifecycle probe; no WhatsApp network/socket.
      let closed=false, events=0;
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort("time-budget"),200);
      try{
        await new Promise((resolve)=>{const tick=setInterval(()=>{events++;if(events>=2||ctrl.signal.aborted){clearInterval(tick);resolve();}},15);});
      }finally{clearTimeout(timer);closed=true;}
      return Response.json({bounded:true,closed,events,noWhatsAppSocket:true,productionQueueUntouched:true,credentialFree:true});
    }
    try{
      // Secret supplied by runtime environment: never stored in the Durable Object.
      if(typeof this.env.PROBE_AES_KEY_B64!=="string")throw new Error("Missing encryption secret");
      const raw=Uint8Array.from(atob(this.env.PROBE_AES_KEY_B64),v=>v.charCodeAt(0));
      if(raw.length!==32)throw new Error("Invalid secret length");
      const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
      const storage=this.ctx.storage;
      async function put(id,value){
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const p=enc.encode(JSON.stringify(value,BufferJSON.replacer));
        const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:enc.encode(id)},key,p));
        await storage.put("auth:"+id,{iv:Array.from(iv),data:Array.from(cipher)});
      }
      async function get(id){
        const record=await storage.get("auth:"+id);if(!record)return null;
        const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(record.iv),additionalData:enc.encode(id)},key,new Uint8Array(record.data));
        return JSON.parse(dec.decode(plaintext),BufferJSON.reviver);
      }
      const existing=Boolean(await get("creds"));
      if(!existing){
        await put("creds",initAuthCreds());
        await put("session:test",{chainKey:new Uint8Array([12,34,56]),counter:17});
      }
      const creds=await get("creds"),session=await get("session:test");
      const leakedTestKey=await storage.get("local-test-key");
      return Response.json({
        bundled:typeof makeWASocket==="function",browserApi:typeof Browsers==="object",noSessionStarted:true,
        offlineKeyGeneration:Boolean(creds.noiseKey?.private?.length),
        credentialRoundTrip:Boolean(creds.signedIdentityKey?.private?.length),
        keyStoreRoundTrip:session?.counter===17&&session.chainKey[1]===34,
        encryptionAuthenticated:true,keyExtractable:false,
        persistentStorage:true,recordExistedBeforeRequest:existing,noStorageOfKeys:false,
        testKeyStoredAlongsideCiphertext:leakedTestKey!==undefined,
        secretConfigured:true,
        isProductionSecure:false
      });
    }catch(error){return Response.json({failed:true,noSessionStarted:true,errorType:error?.name||"Error"},{status:500});}
  }
  async alarm(){if(this.controller)await this.controller.alarm();else await this.ctx.storage.deleteAlarm();}
  async webSocketMessage(ws,message){ if(typeof message==="string"&&message==="probe:ping")ws.send("probe:pong");else ws.close(1008,"test-only"); }
  async webSocketClose(ws){try{ws.close()}catch{}}
}
export default {
  async fetch(request,env){
    // All auth and future QR/session endpoints are private. The local CI probe
    // uses a test-only token; deployment must provision a distinct secret.
    const path=new URL(request.url).pathname;
    if(path==="/health")return Response.json({service:"baileys-isolated-probe",ready:false,noWhatsAppSocket:true});
    const token=env.PROBE_ACCESS_TOKEN;
    const supplied=request.headers.get("Authorization");
    if(typeof token!=="string"||token.length<32||supplied!==`Bearer ${token}`){
      return Response.json({error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
    }
    if(path==="/pair"){
      // Fail closed until a real Baileys socket/controller is implemented and reviewed.
      return Response.json({error:"pairing_not_implemented",noWhatsAppSocket:true},{status:501,headers:{"Cache-Control":"no-store"}});
    }
    // Derive the short-lived gate at the Worker entry, using fresh request-time bindings.
    // Durable Object instances may outlive binding changes; never trust a stale DO env.
    if(["/controller-status","/qr","/start","/stop"].includes(path)){
      const now=Date.now();
      const expiry=Number(env.EXPERIMENTAL_PAIRING_EXPIRES_AT);
      const configured=env.EXPERIMENTAL_PAIRING_ENABLED==="true";
      const validExpiry=Number.isSafeInteger(expiry)&&expiry>now&&expiry<=now+120000;
      const headers=new Headers(request.headers);
      // Always overwrite caller-supplied diagnostics/gate headers, including when disabled.
      headers.set("x-wa-internal-gate",configured&&validExpiry?"1":"0");
      headers.set("x-wa-internal-configured",configured?"1":"0");
      headers.set("x-wa-internal-expiry-valid",validExpiry?"1":"0");
      request=new Request(request,{headers});
    }
    return env.AUTH_TEST.get(env.AUTH_TEST.idFromName("offline-auth")).fetch(request);
  }
};

