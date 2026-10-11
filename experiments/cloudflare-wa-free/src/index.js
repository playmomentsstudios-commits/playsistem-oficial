// Isolated Cloudflare Free probe. Synthetic data ONLY, never WhatsApp credentials.
const toB64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export class BridgeProbe {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/probe") {
      const old = (await this.state.storage.get("boots")) || 0;
      await this.state.storage.put("boots", old + 1);
      return Response.json({service:"sagamente-wa-cloudflare-probe",safe:true,storageWritable:true,boots:old+1,websocketApi:typeof WebSocket==="function"});
    }
    if (path === "/session-probe") {
      const key = "synthetic-session-test";
      if (!await this.state.storage.get(key)) {
        await this.state.storage.put(key, {kind:"synthetic-only",version:1,marker:crypto.randomUUID(),created:new Date().toISOString()});
      }
      const data = await this.state.storage.get(key);
      return Response.json({service:"sagamente-wa-cloudflare-probe",syntheticOnly:true,storedSessionMarker:typeof data?.marker==="string",marker:data?.marker,created:data?.created,persistsAcrossRequests:true,notBaileysAuth:true});
    }
    if (path === "/crypto-probe") {
      if (typeof this.env.PROBE_AES_KEY_B64 !== "string") {
        return Response.json({service:"sagamente-wa-cloudflare-probe",secretConfigured:false,syntheticOnly:true},{status:503});
      }
      const raw = fromB64(this.env.PROBE_AES_KEY_B64);
      if (raw.length !== 32) return Response.json({secretConfigured:false,syntheticOnly:true},{status:503});
      const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt","decrypt"]);
      let sealed = await this.state.storage.get("synthetic-sealed-v1");
      if (!sealed) {
        const plaintext = new TextEncoder().encode(JSON.stringify({kind:"synthetic-only",marker:crypto.randomUUID()}));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plaintext));
        sealed = {v:1,iv:toB64(iv),ciphertext:toB64(ciphertext)};
        await this.state.storage.put("synthetic-sealed-v1",sealed);
      }
      const decrypted = new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(sealed.iv)},key,fromB64(sealed.ciphertext)));
      const result = JSON.parse(new TextDecoder().decode(decrypted));
      return Response.json({service:"sagamente-wa-cloudflare-probe",syntheticOnly:true,encryptedAtRest:true,aesGcmRoundTrip:result.kind==="synthetic-only",persistentCiphertext:true,keyNotExposed:true,notBaileysAuth:true});
    }
    return new Response("Not found",{status:404});
  }
}
export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    if (!["/probe","/session-probe","/crypto-probe"].includes(path)) return new Response("Not found",{status:404});
    return env.BRIDGE_PROBE.get(env.BRIDGE_PROBE.idFromName("isolated-probe")).fetch(request);
  }
};
