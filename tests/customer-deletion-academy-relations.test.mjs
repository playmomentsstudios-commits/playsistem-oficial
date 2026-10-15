import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const edge=readFileSync(new URL('../supabase/functions/admin-delete-customer-all/index.ts',import.meta.url),'utf8')
const sql=readFileSync(new URL('../supabase/migrations/20261015011200_customer_deletion_academy_cleanup.sql',import.meta.url),'utf8')
const ui=readFileSync(new URL('../src/pages/admin/AdminCustomerDetailV2.tsx',import.meta.url),'utf8')

test('every deletion preview checks academy enrollment, attempts, certificates and protected documents',()=>{
 for(const name of ['academy_students','academy_enrollments','academy_attempts','academy_certificates',
   'academy_documents','academic_signed_records']){
   assert.match(edge,new RegExp(name))
   assert.match(ui,new RegExp(name))
 }
 assert.match(edge,/ctx\.db\.rpc\("admin_customer_academy_summary"/)
 assert.match(edge,/if\(result.error\) throw result.error/)
 assert.match(edge,/const mustForce=operationalTotal\+academicTotal>0/)
})

test('the normal deletion path blocks any academy history, even an otherwise empty student',()=>{
 assert.match(edge,/if\(action==="standard" && mustForce\)/)
 assert.match(ui,/Este cadastro não possui histórico operacional ou acadêmico/)
})

test('full deletion requires owner admin and two explicit confirmations',()=>{
 assert.match(edge,/ctx\.role !== "admin"/)
 assert.match(edge,/confirmation !== String\(customer.email/)
 assert.match(edge,/phrase!=="EXCLUIR TUDO"/)
 assert.match(edge,/customerId === ctx.userId/)
})

test('academy cleanup cannot run from an anonymous or ordinary customer session',()=>{
 assert.match(sql,/security definer set search_path=''/)
 assert.match(sql,/revoke all on function public\.admin_customer_cleanup_academy\(uuid\) from public,anon,authenticated/)
 assert.match(sql,/grant execute on function public\.admin_customer_cleanup_academy\(uuid\) to service_role/)
 assert.match(edge,/if\(action==="force" && academicTotal>0\)/)
})

test('academic deletion resolves dependent rows in a single SQL transaction',()=>{
 const answers=sql.indexOf('delete from public.academy_answers')
 const attempts=sql.indexOf('delete from public.academy_attempts')
 const documents=sql.indexOf('delete from public.academy_documents')
 const programs=sql.indexOf('delete from public.academy_program_enrollments')
 const enrollments=sql.indexOf('delete from public.course_enrollments')
 const students=sql.indexOf('delete from public.academy_students')
 assert.ok(answers>=0&&answers<attempts)
 assert.ok(attempts<documents&&documents<programs&&programs<enrollments&&enrollments<students)
 assert.match(sql,/academic_signed_records|signed_records/)
 assert.match(sql,/raise exception 'Este cliente possui documentos assinados/)
})

test('signed records and non-academic external references fail closed before deletion',()=>{
 for(const code of ['ACADEMY_SIGNED_RECORDS','ACTIVE_RENTALS','WHATSAPP_DELIVERY_TARGET','SHARED_CONVERSATION_HISTORY']){
   assert.match(edge,new RegExp(code))
 }
 assert.match(edge,/if\(summary\.academic_signed_records>0\)/)
 assert.match(ui,/deleteSummary.has_protected_records/)
 assert.match(edge,/await ctx\.db\.auth\.admin\.deleteUser\(customerId\)/)
})
