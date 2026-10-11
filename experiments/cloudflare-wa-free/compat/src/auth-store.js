// Experimental isolated Baileys authentication adapter. Never expose auth content over HTTP.
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
const te=new TextEncoder(),td=new TextDecoder();
export async function createEncryptedAuthState(storage,secret){
  if(typeof secret!=="string")throw new Error("Missing authentication encryption key");
  const raw=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));
  if(raw.length!==32)throw new Error("Invalid encryption key length");
  const cryptoKey=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
  const dbKey=(type,id)=>"baileys:v1:"+type+":"+id;
  async function read(type,id){
    const name=dbKey(type,id),record=await storage.get(name);
    if(!record)return null;
    const buf=await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(record.iv),additionalData:te.encode(name)},cryptoKey,new Uint8Array(record.cipher));
    return JSON.parse(td.decode(buf),BufferJSON.reviver);
  }
  async function write(type,id,value){
    const name=dbKey(type,id);
    if(value===null||value===undefined){await storage.delete(name);return;}
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const bytes=te.encode(JSON.stringify(value,BufferJSON.replacer));
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:te.encode(name)},cryptoKey,bytes));
    await storage.put(name,{version:1,iv:Array.from(iv),cipher:Array.from(cipher)});
  }
  let creds=await read("creds","main");
  if(!creds){creds=initAuthCreds();await write("creds","main",creds);}
  const keys={
    async get(type,ids){const result={};for(const id of ids){const v=await read(type,id);if(v!==null)result[id]=v;}return result;},
    async set(data){for(const [type,entries] of Object.entries(data)){for(const [id,value] of Object.entries(entries)){await write(type,id,value);}}},
  };
  return {state:{creds,keys},saveCreds:async()=>write("creds","main",creds)};
}
