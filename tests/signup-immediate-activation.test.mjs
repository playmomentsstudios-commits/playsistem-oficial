import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261015033000_signup_welcome_immediate_activation.sql')
const auth=read('src/contexts/AuthContext.tsx')
const register=read('src/pages/public/RegisterPage.tsx')

test('automatic activation has a dedicated after-insert trigger executed after profile creation',()=>{
 assert.match(sql,/create trigger zz_customer_immediate_account_welcome/)
 assert.match(sql,/after insert on auth\.users/)
 assert.match(sql,/new\.email_confirmed_at is not null/)
 assert.match(sql,/customer_welcome_after_email_confirmation\(\)/)
 assert.match(sql,/if tg_op='UPDATE' then/)
 assert.match(sql,/if old\.email_confirmed_at is not null then return new/)
 const insert=sql.indexOf("create trigger zz_customer_immediate_account_welcome")
 assert.ok(insert>0)
})

test('notifications never claim an auto-activated email was verified, while remaining idempotent',()=>{
 assert.match(sql,/on conflict\(user_id\) do nothing returning user_id into v_inserted/)
 assert.match(sql,/if v_inserted is null then return new/)
 assert.match(sql,/Sua conta está ativa/)
 assert.match(sql,/Novo cadastro ativado/)
 assert.match(sql,/activated_signup/)
 assert.doesNotMatch(sql,/Seu e-mail foi confirmado/)
 assert.match(sql,/wa_bridge_customer_eligible\(new\.id\)/)
 assert.match(sql,/revoke all on function public\.customer_welcome_after_email_confirmation/)
})

test('auth redirects immediately if signup has session; otherwise shows pending instructions',()=>{
 assert.match(auth,/const \{ data, error \} = await supabase\.auth\.signUp/)
 assert.match(auth,/if \(!data\.session\) return \{ requiresEmailConfirmation: true, userId: data\.user\.id \}/)
 assert.match(auth,/return \{ requiresEmailConfirmation: false, userId: data\.user\.id \}/)
 assert.match(register,/if \(result\.requiresEmailConfirmation\)/)
 assert.match(register,/navigate\(afterAuthPath\(next, 'customer'\)\)/)
 assert.match(auth,/email not confirmed/i)
 assert.doesNotMatch(register,/Seu link de confirmação será enviado por e-mail, independentemente/)
})
