import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const migration=readFileSync(new URL('../supabase/migrations/20261011220000_whatsapp_editable_templates_and_archive.sql',import.meta.url),'utf8')
const editor=readFileSync(new URL('../src/components/admin/WhatsappMessageTemplates.tsx',import.meta.url),'utf8')
const center=readFileSync(new URL('../src/pages/admin/AdminWhatsappCenter.tsx',import.meta.url),'utf8')

test('templates are not a preview-only facade: writes have admin gate and render in SQL',()=>{
 assert.match(editor,/wa_save_template/)
 assert.match(editor,/supabase\.from\('wa_message_templates'\)/)
 assert.match(editor,/Prévia/)
 assert.match(editor,/Restaurar padrão/)
 assert.match(migration,/create table if not exists public\.wa_message_templates/)
 assert.match(migration,/if not public\.current_user_is_admin\(\)/)
 assert.match(migration,/grant select on public\.wa_message_templates to authenticated/)
 assert.doesNotMatch(migration,/grant (insert|update|delete) on public\.wa_message_templates to authenticated/)
 assert.match(migration,/v_template_key:=case/)
 assert.match(migration,/select body into v_template_body from public\.wa_message_templates/)
 assert.match(migration,/replace\(v_template_body,'\{\{project_name\}\}',v_project_name\)/)
 assert.match(migration,/v_body:=v_body\|\|E'\\n\\n'\|\|v_label\|\|E'\\n'\|\|v_link/)
 assert.match(migration,/project_customer_access/)
 assert.match(migration,/c\.client_visible/)
 assert.match(migration,/f\.drive_file_id/)
 assert.match(migration,/new\.source<>'live'/)
 assert.match(editor,/active:false/)
})

test('template updates reject unknown variables, external URLs and absent link',()=>{
 assert.match(migration,/regexp_replace\(p_body/)
 assert.match(migration,/project_name\|stage_name\|material_name\|customer_name\|link/)
 assert.match(migration,/p_body ~\* 'https\?:\/\/'/)
 assert.match(editor,/Mantenha \{\{link\}\}/)
})

test('archiving preserves queue status and offers reversible admin-only restoration',()=>{
 assert.match(migration,/add column if not exists archived_at/)
 assert.match(migration,/create or replace function public\.wa_set_archive/)
 assert.match(migration,/set archived_at=case when p_archive then now\(\) else null end/)
 assert.doesNotMatch(migration,/delete from public\.whatsapp_message_outbox/)
 assert.match(center,/wa_set_archive/)
 assert.match(center,/showArchived/)
 assert.match(center,/Arquivadas/)
 assert.match(center,/Restaurar/)
 assert.match(center,/Ver mensagem e detalhes/)
})
