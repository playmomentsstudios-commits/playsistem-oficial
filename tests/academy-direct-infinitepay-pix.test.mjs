import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261015160000_academy_direct_pix_purchases.sql')
const checkout=read('supabase/functions/academy-infinitepay-checkout/index.ts')
const webhook=read('supabase/functions/academy-infinitepay-webhook/index.ts')
const ui=read('src/pages/public/AcademyWorkInterestPage.tsx')
const receipt=read('src/pages/public/AcademyWorkPurchaseStatusPage.tsx')
const admin=read('src/pages/admin/AdminAcademySales.tsx')
const register=read('src/pages/public/RegisterPage.tsx')
const auth=read('src/contexts/AuthContext.tsx')
const routes=read('src/AppV2.tsx')
const config=read('supabase/config.toml')
const has=(source,fragments)=>{for(const f of fragments)assert.ok(source.includes(f), 'Expected '+f)}

test('Price defaults and feature flags prohibit unconfigured live charges',()=>{
 has(sql,['academy_work_prices','default 99','default 280','default 299','checkout_enabled boolean not null default false'])
 has(checkout,['ACADEMY_DIRECT_CHECKOUT_ENABLED','INFINITEPAY_HANDLE','price?.checkout_enabled'])
 has(ui,['academy_public_work_prices','Efetuar pagamento via Pix','money(total)'])
 has(admin,['Preços e ativação','Ativar checkout'])
})
test('Authenticated checkout and newly registered guest are distinct but converge on same processor',()=>{
 has(checkout,['auth.getUser(bearer)','auth.admin.getUserById(guestId)','emailMatch','guest.user.email_confirmed_at','guest.user.created_at','profile.role'])
 has(ui,['isAuthenticated','user?.email','RegisterPage embedded','onPurchaseRegistration','guest_user_id:result.userId'])
 has(register,['nextOverride','onPurchaseRegistration'])
 has(auth,['userId: data.user.id'])
})
test('Provider amount, domain and ownership are validated exclusively in backend',()=>{
 has(checkout,['academy_library_works','academy_library_items','academy_work_prices','Number.isSafeInteger(amount)','provider_order_nsu:id','api.checkout.infinitepay.io/links','validCheckoutUrl'])
 assert.ok(!checkout.includes('academy_library_grants'))
 has(ui,['isSafeCheckout','window.location.assign(url)'])
})
test('Webhook never trusts client-paid flags and requires independent provider status check',()=>{
 has(webhook,['api.checkout.infinitepay.io/payment_check','verified?.paid!==true','amount!==order.amount_cents','provider_transaction_nsu','academy_fulfill_verified_purchase'])
 assert.ok(!webhook.includes('academy_library_grants').valueOf ? true : !webhook.includes('academy_library_grants'))
 has(sql,['academy_fulfill_verified_purchase','email_confirmed_at','lower(u.email)=lower(v_order.buyer_email)','paid_waiting_email','academy_library_grants(item_id,user_id,source,active)','source=','after update of email_confirmed_at','academy_finalize_my_paid_works'])
})
test('Receipt is read only, user grant is protected by email verification, and routes are guarded',()=>{
 has(sql,['academy_public_purchase_status','academy_work_purchases_owner_read','revoke all on public.academy_work_purchases'])
 has(receipt,['academy_public_purchase_status','academy_finalize_my_paid_works','Aguardando o Pix','Pagamento recebido. Confirme seu e-mail'])
 has(routes,['path="/academia/compra/:id"','path="academia/vendas"','AdminPermissionGate adminOnly'])
 has(config,['[functions.academy-infinitepay-webhook]','verify_jwt = false'])
 assert.ok(!ui.includes('academy_library_grants'))
})
test('Administrative sales page only edits prices, never marks payment as paid',()=>{
 has(admin,['academy_work_prices','academy_work_purchases','checkout_enabled','Nenhum pedido Pix'])
 assert.ok(!admin.includes("status:'fulfilled'"))
})
