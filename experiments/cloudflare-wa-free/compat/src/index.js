// Runtime-only auth storage test. No WhatsApp socket, QR, credentials or Supabase access.
// Validates Baileys' real BufferJSON serialization encrypted using WebCrypto AES-GCM.
import makeWASocket, { Browsers, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
const enc=new TextEncoder(),dec=new TextDecoder();
export default {
  async fetch() {
    try {
      const creds=initAuthCreds();
      const store=new Map(); // intentionally ephemeral: Durable Object storage comes next
      const aesKey=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
      async function save(id, data) {
        const iv=crypto.getRandomValues(new Uint8Array(12));
        const bytes=enc.encode(JSON.stringify(data,BufferJSON.replacer));
        const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},aesKey,bytes);
        store.set(id,{iv,cipher});
      }
      async function load(id) {
        const entry=store.get(id);
        if(!entry)return null;
        const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:entry.iv},aesKey,entry.cipher);
        return JSON.parse(dec.decode(plain),BufferJSON.reviver);
      }
      await save("creds",creds);
      const restored=await load("creds");
      await save("session-1",{chainKey:new Uint8Array([12,34,56]),counter:17});
      const session=await load("session-1");
      let tamperRejected=false;
      const entry=store.get("creds");
      const corrupt=new Uint8Array(entry.cipher.slice(0));corrupt[0]^=1;
      store.set("creds",{iv:entry.iv,cipher:corrupt.buffer});
      try{await load("creds")}catch{tamperRejected=true}
      return Response.json({
        bundled:typeof makeWASocket==="function",browserApi:typeof Browsers==="object",noSessionStarted:true,
        offlineKeyGeneration:Boolean(creds.noiseKey?.private),
        credentialRoundTrip:restored.noiseKey.private.length===creds.noiseKey.private.length,
        keyStoreRoundTrip:session.counter===17&&session.chainKey[1]===34,
        encryptionAuthenticated:tamperRejected,
        keyExtractable:aesKey.extractable,
        persistentStorage:false,
        noStorageOfKeys:true
      });
    }catch(error){return Response.json({noSessionStarted:true,errorType:error?.name||"Error",failed:true},{status:500})}
  }
};
