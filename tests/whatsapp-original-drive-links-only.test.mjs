import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const sql=readFileSync(new URL('../supabase/migrations/20261011043000_wa_use_original_drive_links.sql',import.meta.url),'utf8')
const existing=readFileSync(new URL('../supabase/migrations/20261011013000_wa_relevant_task_files_and_human_updates.sql',import.meta.url),'utf8')
const bridge=readFileSync(new URL('../services/whatsapp-bridge/index.mjs',import.meta.url),'utf8')

test('WhatsApp notices use the original Drive URL for every eligible task file',()=>{
  assert.match(sql,/f\.external_url ~/)
  assert.match(sql,/https:\/\/drive\[.\]google\[.\]com\/file\/d\//)
  assert.match(sql,/v_file_url:=f\.external_url/)
  assert.match(sql,/v_file_url:='https:\/\/drive\.google\.com\/file\/d\/'\|\|f\.drive_file_id\|\|'\/view'/)
  assert.match(sql,/v_body:=v_body\|\|E'\\n\\n'\|\|v_group\|\|'\*'\|\|v_file_name\|\|'\*'\|\|E'\\n'\|\|\s*v_file_url/)
  assert.doesNotMatch(sql,/whatsapp-file-open\?t=/)
  assert.doesNotMatch(sql,/insert into public\.wa_file_message_links/)
})
test('task messages retain the existing wording and task/stage file selections',()=>{
  for(const marker of [
    'Seu projeto deu mais um passo!',
    'Estamos avançando na sua entrega!',
    'Mais uma entrega concluída!',
    'n.type=\'project_task\' and c.task_id=v_task',
    'n.type=\'project_stage\'',
    'c.client_visible',
    "c.storage_provider='google_drive'",
    't.client_visible',
    's.client_visible',
    'project_customer_access',
    'row_number() over(partition by coalesce(e.version_group_id,e.id)',
    "v_label:='🔎 *Acompanhe a tarefa:*'",
    "v_label:='🔎 *Acompanhe a etapa:*'",
  ]){
    assert.ok(sql.includes(marker),'Missing previously-working logic: '+marker)
    assert.ok(existing.includes(marker),'Baseline did not contain marker: '+marker)
  }
  assert.match(sql,/new\.target_link ~ '\^\/n\/\[A-Za-z0-9_-\]\{22\}\$'/)
  assert.match(sql,/v_body:=v_body\|\|E'\\n\\n'\|\|v_label\|\|E'\\n'\|\|v_link;/)
  assert.doesNotMatch(sql,/Links dos arquivos válidos por 48 horas\. Não compartilhe\./)
})
test('original file link cannot redirect to arbitrary websites or another Drive file',()=>{
  assert.match(sql,/f\.drive_file_id !~ '\^\[A-Za-z0-9_-\]\{10,128\}\$'/)
  assert.match(sql,/f\.external_url ~ \('\^https:\/\/drive\[.\]google\[.\]com\/file\/d\/'/)
  assert.match(sql,/f\.drive_file_id\|\|'\/view/)
  assert.doesNotMatch(sql,/anyoneWithLink|permissions\.create|grant_public_access/i)
})
test('Windows bridge no longer sends original files as WhatsApp documents',()=>{
  assert.match(bridge,/const result=await socket\.sendMessage\(address,\{text:job\.message\}\)/)
  assert.doesNotMatch(bridge,/sendAttachmentsForNotification/)
  assert.doesNotMatch(bridge,/media-attachments\.mjs/)
  assert.match(bridge,/wa_bridge_register_destination/)
  assert.match(bridge,/wa_bridge_worker_capability/)
})
