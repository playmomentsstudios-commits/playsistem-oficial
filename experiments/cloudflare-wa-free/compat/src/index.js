// Offline cryptographic smoke test. Does not connect to WhatsApp, issue a QR or access production data.
import makeWASocket, { Browsers, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
export default {
  async fetch() {
    try {
      const creds=initAuthCreds();
      const serialized=JSON.stringify({creds},BufferJSON.replacer);
      const restored=JSON.parse(serialized,BufferJSON.reviver).creds;
      const keyOk=Boolean(creds.noiseKey?.private && creds.signedIdentityKey?.private && restored.noiseKey?.private);
      return Response.json({bundled:typeof makeWASocket==="function",browserApi:typeof Browsers==="object",noSessionStarted:true,offlineKeyGeneration:keyOk,credentialRoundTrip:Boolean(restored.noiseKey?.private?.length===creds.noiseKey?.private?.length),noStorageOfKeys:true});
    }catch(error){
      return Response.json({bundled:typeof makeWASocket==="function",noSessionStarted:true,offlineKeyGeneration:false,errorType:error?.name||"Error"},{status:500});
    }
  }
};
