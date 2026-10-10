import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {"Content-Type":"application/json","Cache-Control":"no-store"};
const response = (payload:unknown,status=200) => new Response(JSON.stringify(payload),{status,headers});
function equalSecret(a:string,b:string) {
  const enc = new TextEncoder();
  const left = enc.encode(a),right = enc.encode(b);
  let diff = left.length ^ right.length;
  for (let i=0;i<Math.max(left.length,right.length);i++) diff|=(left[i]||0)^(right[i]||0);
  return diff===0 && !!a;
}
function category(type:string) {
  if (type==="new_message") return "messages";
  if (/^file|^client_file|^review_/.test(type)) return "files";
  if (/^project|^task|^stage|^assignment/.test(type)) return "projects";
  if (/^order|^quote|^payment|^rental|^commercial/.test(type)) return "commercial";
  if (/^deadline|^due_/.test(type)) return "deadlines";
  return "projects";
}
function safeLink(value:unknown,role:string) {
  const path = String(value||"");
  const allowed = role==="customer" ? /^\/app\/[a-zA-Z0-9/_-]*(?:\?[a-zA-Z0-9=&_-]*)?$/ :
    /^\/admin\/[a-zA-Z0-9/_-]*(?:\?[a-zA-Z0-9=&_-]*)?$/;
  return allowed.test(path) ? path : role==="customer"?"/app/notificacoes":"/admin/notificacoes";
}
function safeNotice(kind:string,role:string,path:string,unreadCount:number) {
  const texts:Record<string,[string,string]> = {
    messages:["Nova mensagem na Sagamente","Você recebeu uma nova mensagem."],
    projects:["Projeto atualizado","Há novidades no acompanhamento de um projeto."],
    files:["Arquivo ou aprovação","Um arquivo ou uma entrega teve atualização."],
    commercial:["Atualização comercial","Há novidades sobre um pedido, orçamento ou pagamento."],
    deadlines:["Prazo de entrega","Você tem uma atualização de prazo para acompanhar."],
  };
  const [title,body] = texts[kind] || texts.projects;
  return {title,body,url:path,tag:"sagamente-"+kind,icon:"/pwa/icon-192.png",
    badge:"/pwa/icon-192.png",category:kind,role,unreadCount};
}
type Entry = {queue_id:string;notification_id:string;user_id:string;type:string;link:string;metadata?:Record<string,any>};
async function deliver(db:any,item:Entry) {
  const [account,preference,subscriptions] = await Promise.all([
    db.from("profiles").select("role,status").eq("id",item.user_id).maybeSingle(),
    db.from("user_preferences").select("notify_push,notify_project_updates,notify_file_updates,notify_commercial_updates,notify_portal").eq("user_id",item.user_id).maybeSingle(),
    db.from("push_subscriptions").select("id,endpoint,p256dh,auth_secret,categories")
      .eq("user_id",item.user_id).eq("enabled",true).limit(5),
  ]);
  if (account.error||preference.error||subscriptions.error) throw new Error("Error reading push recipients");
  const role = account.data?.role;
  const validRole = ["customer","staff","admin"].includes(role) && account.data?.status==="active";
  const pref=preference.data||{};
  const kind=category(item.type);
  const enabled = pref.notify_push!==false && pref.notify_portal!==false &&
    !(kind==="projects"&&pref.notify_project_updates===false) &&
    !(kind==="files"&&pref.notify_file_updates===false) &&
    !(kind==="commercial"&&pref.notify_commercial_updates===false);
  if (!validRole || !enabled) return {success:true,sent:0};
  if (role==="customer" && item.metadata?.project_id) {
    const id = String(item.metadata.project_id);
    const project = await db.from("projects").select("id,customer_id,project_type").eq("id",id).maybeSingle();
    if (project.error||!project.data||project.data.project_type==="internal") return {success:true,sent:0};
    if (project.data.customer_id!==item.user_id) {
      const additional=await db.from("project_customer_access").select("project_id")
        .eq("project_id",id).eq("customer_id",item.user_id).maybeSingle();
      if (additional.error||!additional.data)return {success:true,sent:0};
    }
  }
  if(role==="customer"&&item.metadata?.file_id) {
    const file=await db.from("client_files").select("id,customer_id,project_id,client_visible")
      .eq("id",String(item.metadata.file_id)).maybeSingle();
    if(file.error||!file.data?.client_visible)return {success:true,sent:0};
    if (file.data.customer_id!==item.user_id) {
      const access=await db.from("project_customer_access").select("project_id")
        .eq("project_id",file.data.project_id).eq("customer_id",item.user_id).maybeSingle();
      if(!access.data)return {success:true,sent:0};
    }
  }
  const filtered=(subscriptions.data||[]).filter((sub:any)=>sub.categories?.[kind]!==false);
  if (!filtered.length) return {success:true,sent:0};
  const link=safeLink(item.link,role);
  // The badge represents the actual unread inbox, not just one incoming Push.
  // Never transmit user IDs, notification bodies or message contents to the device.
  const unread=await db.from("notifications").select("id",{count:"exact",head:true})
    .eq("user_id",item.user_id).is("read_at",null);
  if(unread.error) throw new Error("Unable to count unread notifications");
  const unreadCount=Math.max(0,Number(unread.count||0));
  const pushData=JSON.stringify(safeNotice(kind,role,link,unreadCount));
  let sent=0,transient=false;
  for(const sub of filtered) {
    try {
      await webpush.sendNotification({
        endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}
      },pushData,{TTL:3600,urgency:kind==="messages"?"high":"normal"});
      sent++;
      await db.from("push_subscriptions").update({last_sent_at:new Date().toISOString(),failures:0}).eq("id",sub.id);
    } catch (error:any) {
      const status=Number(error?.statusCode||0);
      if(status===404||status===410) {
        await db.from("push_subscriptions").delete().eq("id",sub.id);
      } else {
        transient=true;
        await db.from("push_subscriptions").update({failures:1}).eq("id",sub.id);
      }
    }
  }
  return {success:!transient,sent};
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return response({ok:false},405);
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)return response({ok:false,error:"Backend not configured"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const configResult=await db.rpc("push_internal_config");
  if(configResult.error||!configResult.data)return response({ok:false},503);
  const config=configResult.data;
  if(!equalSecret(req.headers.get("x-sagamente-dispatch")||"",String(config.dispatch_key||"")))
    return response({ok:false,error:"Unauthorized"},401);
  if(!config.vapid_public||!config.vapid_private)return response({ok:true,delivered:0,unconfigured:true});
  webpush.setVapidDetails("mailto:playmomentsstudios@gmail.com",
    config.vapid_public,config.vapid_private);
  const claims=await db.rpc("push_claim_notifications",{p_limit:8});
  if(claims.error)return response({ok:false,error:"Queue unavailable"},500);
  let delivered=0,retried=0;
  for(const item of (claims.data||[]) as Entry[]) {
    try {
      const result=await deliver(db,item);
      delivered+=result.sent;
      const retry=!result.success;
      const previous=(await db.from("push_delivery_queue").select("attempts")
        .eq("id",item.queue_id).single()).data;
      const attempts=Number(previous?.attempts||1);
      const status=retry?(attempts>=5?"failed":"retry"):"sent";
      const next=new Date(Date.now()+Math.min(900000,30000*Math.pow(2,attempts))).toISOString();
      const {error}=await db.from("push_delivery_queue").update({
        status,available_at:next,locked_at:null,finished_at:retry?null:new Date().toISOString()
      }).eq("id",item.queue_id);
      if(error)throw error;
      if(retry)retried++;
    } catch {
      retried++;
      await db.from("push_delivery_queue").update({
        status:"retry",available_at:new Date(Date.now()+120000).toISOString(),locked_at:null
      }).eq("id",item.queue_id);
    }
  }
  return response({ok:true,claimed:(claims.data||[]).length,delivered,retried});
});
