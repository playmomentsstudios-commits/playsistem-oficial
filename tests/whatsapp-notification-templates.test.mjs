import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const templates=readFileSync(new URL('../src/components/admin/WhatsappMessageTemplates.tsx',import.meta.url),'utf8')
const center=readFileSync(new URL('../src/pages/admin/AdminWhatsappCenter.tsx',import.meta.url),'utf8')
const migration=readFileSync(new URL('../supabase/migrations/20261011160000_whatsapp_project_notification_copy.sql',import.meta.url),'utf8')

test('the admin preview presents six concise customer-facing WhatsApp models with project context and a link slot',()=>{
 for(const title of ['Projeto iniciado','Materiais finalizados','Revisão disponível','Ajustes concluídos','Entrega final','Nova mensagem']) assert.match(templates,new RegExp(title))
 assert.equal((templates.match(/title:'/g)||[]).length,6)
 assert.equal((templates.match(/\{\{link\}\}/g)||[]).length>=6,true)
 assert.match(templates,/Prévia com dados de exemplo/)
 assert.match(templates,/wa_save_template/)
 assert.match(templates,/Restaurar padrão/)
 assert.doesNotMatch(templates,/tarefa|painel do cliente|responsável interno/i)
 assert.match(center,/>Modelos<\/button>/)
})

test('manual opening does not append the same compact notification destination twice',()=>{
 assert.match(center,/alreadyHasTarget=Boolean\(item\.target_link&&item\.message_body\.includes\(item\.target_link\)\)/)
 assert.match(center,/!alreadyHasTarget/)
})

test('generated external project copy contains no task wording and preserves compact authenticated destinations',()=>{
 assert.doesNotMatch(migration,/A tarefa|Acompanhe a tarefa|na tarefa|da tarefa/i)
 assert.match(migration,/new\.target_link ~ '\^\/n\/\[A-Za-z0-9_-\]\{22\}\$'/)
 assert.match(migration,/v_project_name/)
 assert.match(migration,/on conflict|new\.source<>'live'/)
 assert.match(migration,/\*Revisão disponível\*/)
 assert.match(migration,/\*Etapa concluída\*/)
 assert.match(migration,/v_status='active'/)
 assert.match(migration,/v_status='completed'/)
 assert.match(migration,/review.action='changes_requested'/)
 assert.doesNotMatch(migration,/Links dos arquivos válidos por 48 horas/)
})
