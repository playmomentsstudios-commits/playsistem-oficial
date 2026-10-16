import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Saga identity is limited to the Play Sistem admin feature',()=>{
 const page=read('src/pages/admin/AdminSagaAssistant.tsx');
 const doc=read('docs/assistente-sagamente-v1.md');
 assert.match(page,/Sou a Saga, assistente deste sistema/);
 assert.match(page,/Play Sistem · Assistente operacional/);
 assert.match(doc,/somente no Play Sistem/);
 assert.match(doc,/não deve ser propagada a outros chats/);
 assert.match(doc,/não identidade universal do ChatGPT/);
});

test('assistant speaks in first person about its own actions, not in third person',()=>{
 const page=read('src/pages/admin/AdminSagaAssistant.tsx');
 const preview=read('src/pages/admin/SagaDigestPreviewPanel.tsx');
 const doc=read('docs/assistente-sagamente-v1.md');
 assert.match(page,/Salvei suas preferências\. Não ativei os envios/);
 assert.match(page,/Não consegui concluir esta operação/);
 assert.match(preview,/Não consegui consultar a prévia/);
 assert.match(preview,/Não enviei nenhuma mensagem/);
 assert.match(doc,/Não consegui enviar/);
 assert.doesNotMatch(page,/A Saga não conseguiu/);
 assert.doesNotMatch(preview,/A Saga não conseguiu/);
});

test('do not conflate queue, sent and delivered, or add emails for Saga',()=>{
 const doc=read('docs/assistente-sagamente-v1.md');
 assert.match(doc,/Entreguei.*confirmação de entrega/);
 assert.match(doc,/Enfileiramento|Coloquei na fila/);
 assert.match(doc,/Não adicionar e-mail como canal/);
 assert.match(doc,/não valida automaticamente.*emissor próprio da Saga/);
});

test('nomenclature changes do not alter the legacy WhatsApp bridge or enable dispatch',()=>{
 const page=read('src/pages/admin/AdminSagaAssistant.tsx');
 assert.doesNotMatch(page,/wa_bridge_claim\s*\(/);
 assert.doesNotMatch(page,/cron\.schedule\s*\(/);
 assert.doesNotMatch(page,/\.update\(\{\s*whatsapp_notifications\s*:/);
});
