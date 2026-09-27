import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};

export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
export function env(name:string){const value=Deno.env.get(name);if(!value)throw new Error("Missing secret: "+name);return value}
export function serviceDb(){return createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}})}
export async function requireCustomer(req:Request){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)throw new Error("Unauthorized");
 const db=serviceDb();const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw new Error("Unauthorized");
 const {data:profile,error:pe}=await db.from("profiles").select("id,email,first_name,last_name,role,status").eq("id",data.user.id).single();
 if(pe||!profile||profile.role!=="customer"||profile.status!=="active")throw new Error("Customer access required");
 return {db,userId:data.user.id,profile};
}
export function asaasBaseUrl(){return (Deno.env.get("ASAAS_BASE_URL")||"https://api-sandbox.asaas.com/v3").replace(/\/$/,"")}
export async function asaas(path:string,init:RequestInit={}){
 const response=await fetch(asaasBaseUrl()+path,{...init,headers:{"Content-Type":"application/json","User-Agent":"PlayMoments/1.0 (Supabase Edge Function)","access_token":env("ASAAS_API_KEY"),...(init.headers||{})}});
 const raw=await response.text();let payload:any=null;try{payload=raw?JSON.parse(raw):null}catch{payload={raw}}
 if(!response.ok)throw new Error(payload?.errors?.map((e:any)=>e.description).join("; ")||payload?.message||("Asaas error "+response.status));
 return payload;
}
export async function ensureAsaasCustomer(db:SupabaseClient,profile:any){
 const {data:existing}=await db.from("payments").select("provider_customer_id").eq("customer_id",profile.id).eq("provider","asaas").not("provider_customer_id","is",null).limit(1).maybeSingle();
 if(existing?.provider_customer_id)return existing.provider_customer_id;
 const customer=await asaas("/customers",{method:"POST",body:JSON.stringify({name:[profile.first_name,profile.last_name].filter(Boolean).join(" ")||profile.email,email:profile.email,externalReference:profile.id})});
 return customer.id as string;
}