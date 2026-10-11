// Isolated Cloudflare Free probe: NO WhatsApp credentials or production data.
export class BridgeProbe {
  constructor(state){ this.state=state; }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==="/probe"){
      const old=await this.state.storage.get("boots")||0;
      await this.state.storage.put("boots",old+1);
      return Response.json({service:"sagamente-wa-cloudflare-probe",safe:true,storageWritable:true,boots:old+1,websocketApi:typeof WebSocket==="function",date:new Date().toISOString()});
    }
    if(path==="/session-probe"){
      // Only a deliberately synthetic marker; never persist a real auth key here.
      const key="synthetic-session-test";
      const old=await this.state.storage.get(key);
      if(!old){
        const sample={kind:"synthetic-only",version:1,marker:crypto.randomUUID(),created:new Date().toISOString()};
        await this.state.storage.put(key,sample);
      }
      const data=await this.state.storage.get(key);
      return Response.json({service:"sagamente-wa-cloudflare-probe",syntheticOnly:true,storedSessionMarker:typeof data?.marker==="string",marker:data?.marker,created:data?.created,persistsAcrossRequests:true,notBaileysAuth:true});
    }
    return new Response("Not found",{status:404});
  }
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path!=="/probe"&&path!=="/session-probe")return new Response("Not found",{status:404});
    return env.BRIDGE_PROBE.get(env.BRIDGE_PROBE.idFromName("isolated-probe")).fetch(request);
  }
};
