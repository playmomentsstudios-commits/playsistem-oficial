// Meta WhatsApp webhook verification + signed-event receipt.
// No database writes and NO outgoing WhatsApp messages in this pilot.
const utf8=new TextEncoder();
const plainHeaders={"cache-control":"no-store","x-content-type-options":"nosniff"};
function response(status,body,contentType="application/json"){
  return new Response(contentType==="application/json"?JSON.stringify(body):body,
    {status,headers:{...plainHeaders,"content-type":contentType}});
}
function equalBytes(a,b){
  let mismatch=a.length^b.length;
  const max=Math.max(a.length,b.length);
  for(let i=0;i<max;i++)mismatch|=(a[i]??0)^(b[i]??0);
  return mismatch===0;
}
function decodeHex(hex){
  const a=new Uint8Array(hex.length/2);
  for(let i=0;i<a.length;i++)a[i]=Number.parseInt(hex.slice(i*2,i*2+2),16);
  return a;
}
export function createMetaWebhookHandler(getEnv){
  return async function metaWebhook(request){
    try {
      if(request.method==="GET"){
        const token=getEnv("META_WA_VERIFY_TOKEN");
        if(!token||token.length<24)return response(503,{error:"webhook_not_configured"});
        const url=new URL(request.url);
        const challenge=url.searchParams.get("hub.challenge")||"";
        const supplied=url.searchParams.get("hub.verify_token")||"";
        if(url.searchParams.get("hub.mode")!=="subscribe"||
           !/^\d{1,128}$/.test(challenge)||
           !equalBytes(utf8.encode(supplied),utf8.encode(token))){
          return response(403,{error:"verification_failed"});
        }
        return response(200,challenge,"text/plain; charset=utf-8");
      }
      if(request.method!=="POST")return response(405,{error:"method_not_allowed"});
      const appSecret=getEnv("META_WA_APP_SECRET");
      if(!appSecret||appSecret.length<16)return response(503,{error:"signature_verification_not_configured"});
      const header=request.headers.get("x-hub-signature-256")||"";
      const match=/^sha256=([a-f0-9]{64})$/i.exec(header);
      if(!match)return response(403,{error:"invalid_signature"});
      if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||"")){
        return response(415,{error:"unsupported_media_type"});
      }
      const length=Number(request.headers.get("content-length")||0);
      if(length>262144)return response(413,{error:"payload_too_large"});
      const raw=new Uint8Array(await request.arrayBuffer());
      if(raw.length>262144)return response(413,{error:"payload_too_large"});
      const key=await crypto.subtle.importKey("raw",utf8.encode(appSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,raw));
      if(!equalBytes(signed,decodeHex(match[1])))return response(403,{error:"invalid_signature"});
      let data;
      try {data=JSON.parse(new TextDecoder().decode(raw));}
      catch{return response(400,{error:"invalid_json"});}
      if(data?.object!=="whatsapp_business_account"||!Array.isArray(data?.entry))
        return response(400,{error:"unexpected_webhook"});
      // ACK only: no message content is persisted, sent, or logged.
      // Never describe this as confirmed delivery; status processing is a later change.
      return response(200,{received:true,processed:false});
    }catch{
      return response(500,{error:"webhook_handler_error"});
    }
  };
}
