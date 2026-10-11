// Isolated Cloudflare Free compatibility probe. NO WhatsApp credentials,
// NO message dispatch, NO access to the production queue.
export class BridgeProbe {
  constructor(state){ this.state=state; }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname!=="/probe")return new Response("Not found",{status:404});
    const old=await this.state.storage.get("boots")||0;
    await this.state.storage.put("boots",old+1);
    const wsSupported=typeof WebSocket==="function";
    return Response.json({service:"sagamente-wa-cloudflare-probe",safe:true,storageWritable:true,boots:old+1,websocketApi:wsSupported,nodeProcess:typeof process!=="undefined",date:new Date().toISOString()});
  }
}
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname!=="/probe") return new Response("Not found",{status:404});
    return env.BRIDGE_PROBE.get(env.BRIDGE_PROBE.idFromName("isolated-probe")).fetch(request);
  }
};
