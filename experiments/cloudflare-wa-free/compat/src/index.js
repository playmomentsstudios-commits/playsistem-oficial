// Offline-only Baileys auth adapter test in Durable Object with encrypted SQLite-backed storage.
// This does not connect to WhatsApp, publish QR codes, or access production.
import makeWASocket, { Browsers, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
const enc=new TextEncoder(),dec=new TextDecoder();
export class EncryptedAuthProbe {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async fetch(){
    try{
      // Ephemeral test encryption key exists only for this local runtime; not production.
      // Test uses a generated key persisted in DO to check read/write mechanics ONLY.
      let raw=await this.ctx.storage.get("local-test-key");
      if(!raw){raw=Array.from(crypto.getRandomValues(new Uint8Array(32)));await this.ctx.storage.put("local-test-key",raw);}
      const key=await crypto.subtle.importKey("raw",new Uint8Array(raw),"AES-GCM",false,["encrypt","decrypt"]);
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
      return Response.json({
        bundled:typeof makeWASocket==="function",browserApi:typeof Browsers==="object",noSessionStarted:true,
        offlineKeyGeneration:Boolean(creds.noiseKey?.private?.length),
        credentialRoundTrip:Boolean(creds.signedIdentityKey?.private?.length),
        keyStoreRoundTrip:session?.counter===17&&session.chainKey[1]===34,
        encryptionAuthenticated:true,keyExtractable:false,
        persistentStorage:true,recordExistedBeforeRequest:existing,noStorageOfKeys:false,
        testKeyStoredAlongsideCiphertext:true,
        isProductionSecure:false
      });
    }catch(error){return Response.json({failed:true,noSessionStarted:true,errorType:error?.name||"Error"},{status:500});}
  }
}
export default {async fetch(request,env){return env.AUTH_TEST.get(env.AUTH_TEST.idFromName("offline-auth")).fetch(request);}};
