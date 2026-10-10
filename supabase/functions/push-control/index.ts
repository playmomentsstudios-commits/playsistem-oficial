import webpush from "npm:web-push@3.6.7";
import { corsHeaders, json, requireUser } from "../_shared/googleDrive.ts";

const allowedHosts = (host: string) =>
  host === "fcm.googleapis.com" || host === "fcm-xm.googleapis.com" ||
  host === "updates.push.services.mozilla.com" ||
  host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
  host.endsWith(".notify.windows.com");

function validEndpoint(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2048 || raw.length < 20) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") && allowedHosts(url.hostname.toLowerCase());
  } catch { return false; }
}
function categories(value: any): Record<string, boolean> {
  const input = value && typeof value === "object" ? value : {};
  return Object.fromEntries(["messages","projects","files","commercial","deadlines"]
    .map(k => [k, input[k] !== false]));
}
function asText(value: unknown, limit: number) {
  return String(value || "").trim().replace(/[\r\n<>]/g, " ").slice(0, limit);
}
const validKey = (v: unknown, min: number, max: number) =>
  typeof v === "string" && v.length >= min && v.length <= max && /^[a-zA-Z0-9_-]+$/.test(v);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const ctx = await requireUser(req);
    const body = await req.json();
    const action = String(body?.action || "status");
    const configResult = await ctx.db.rpc("push_internal_config");
    if (configResult.error || !configResult.data) throw new Error("Push configuration unavailable");
    let publicKey = String(configResult.data.vapid_public || "");

    if (!publicKey) {
      // Only the server generates/stores private material. Browser never receives it.
      const pair = webpush.generateVAPIDKeys();
      const saved = await ctx.db.rpc("push_install_keys", {
        p_public: pair.publicKey, p_private: pair.privateKey,
      });
      if (saved.error || !saved.data) throw new Error("VAPID setup failed");
      publicKey = String(saved.data);
    }

    if (action === "status") {
      const endpoint = body.endpoint;
      const result = await ctx.db.from("push_subscriptions")
        .select("id,endpoint,categories,device_label,enabled")
        .eq("user_id", ctx.userId).eq("enabled", true).limit(8);
      if (result.error) throw result.error;
      const rows = result.data || [];
      const current = validEndpoint(endpoint) ? rows.find((item:any) => item.endpoint === endpoint) : null;
      return json({ok:true,publicKey,enabled:!!current,categories:current?.categories||categories(null),devices:rows.length});
    }

    if (action === "subscribe") {
      const subscription = body.subscription || {};
      const endpoint = subscription.endpoint;
      const keys = subscription.keys || {};
      if (!validEndpoint(endpoint) || !validKey(keys.p256dh, 40, 256) || !validKey(keys.auth, 15, 256)) {
        return json({ok:false,error:"Assinatura de notificações inválida."},422);
      }
      const existing = await ctx.db.from("push_subscriptions").select("id")
        .eq("user_id",ctx.userId).eq("enabled",true);
      if (existing.error) throw existing.error;
      if ((existing.data || []).length >= 5) {
        const same = await ctx.db.from("push_subscriptions").select("id")
          .eq("endpoint",endpoint).eq("user_id",ctx.userId).maybeSingle();
        if (!same.data) return json({ok:false,error:"Limite de cinco dispositivos. Desative um deles antes de ativar outro."},409);
      }
      const result = await ctx.db.from("push_subscriptions").upsert({
        user_id:ctx.userId,endpoint,p256dh:keys.p256dh,auth_secret:keys.auth,
        device_label:asText(body.deviceLabel,100)||"Dispositivo",
        categories:categories(body.categories),enabled:true,failures:0,updated_at:new Date().toISOString(),
      },{onConflict:"endpoint"});
      if (result.error) throw result.error;
      return json({ok:true,enabled:true,publicKey});
    }

    if (action === "preferences") {
      if (!validEndpoint(body.endpoint)) return json({ok:false,error:"Dispositivo inválido"},422);
      const result = await ctx.db.from("push_subscriptions")
        .update({categories:categories(body.categories),updated_at:new Date().toISOString()})
        .eq("endpoint",body.endpoint).eq("user_id",ctx.userId).eq("enabled",true).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return json({ok:false,error:"Ative notificações neste dispositivo primeiro."},404);
      return json({ok:true});
    }

    if (action === "unsubscribe") {
      if (!validEndpoint(body.endpoint)) return json({ok:false,error:"Dispositivo inválido"},422);
      const {error} = await ctx.db.from("push_subscriptions").delete()
        .eq("user_id",ctx.userId).eq("endpoint",body.endpoint);
      if (error) throw error;
      return json({ok:true,enabled:false});
    }

    if (action === "test") {
      const {data:subscription} = await ctx.db.from("push_subscriptions")
        .select("id").eq("user_id",ctx.userId).eq("enabled",true).limit(1);
      if (!subscription?.length) return json({ok:false,error:"Ative as notificações antes do teste."},400);
      const since = new Date(Date.now()-60000).toISOString();
      const recent = await ctx.db.from("notifications").select("id")
        .eq("user_id",ctx.userId).eq("type","push_test").gte("created_at",since).limit(1);
      if (recent.error) throw recent.error;
      if (recent.data?.length) return json({ok:false,error:"Espere um minuto para enviar outro teste."},429);
      const {error} = await ctx.db.from("notifications").insert({
        user_id:ctx.userId,type:"push_test",title:"Notificações Sagamente ativas",
        message:"Os avisos de mensagens, projetos e arquivos chegarão neste dispositivo.",
        link:ctx.role==="customer"?"/app/notificacoes":"/admin/notificacoes",
      });
      if (error) throw error;
      return json({ok:true,queued:true});
    }
    return json({ok:false,error:"Ação desconhecida"},400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao configurar notificações.";
    const status = /unauthorized|forbidden/i.test(message) ? 401 : 500;
    return json({ok:false,error:message},status);
  }
});
