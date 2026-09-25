import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/attachments.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { validateAttachment, previewKind, attachmentMime, MAX_ATTACHMENT_BYTES } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
test('accepts originals, including spreadsheet and mobile formats; rejects invalid sizes/names', () => {
  for (const name of ['planilha.xlsx','original.psd','foto.heic','áudio.m4a']) assert.equal(validateAttachment({name,size:42}),null)
  assert.equal(validateAttachment({name:'foto.png',size:MAX_ATTACHMENT_BYTES}),null)
  for (const file of [{name:'vazio',size:0},{name:'grande',size:MAX_ATTACHMENT_BYTES+1},{name:'a'.repeat(256),size:42}]) assert.ok(validateAttachment(file))
})
test('uses native media previews and leaves active document formats as download only', () => {
  assert.equal(previewKind('image/png'),'image')
  assert.equal(previewKind('audio/webm;codecs=opus'),'audio')
  assert.equal(previewKind('audio/mp4'),'audio')
  assert.equal(previewKind('video/mp4'),'video')
  for(const type of ['image/svg+xml','text/html','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/heic']) assert.equal(previewKind(type),'file')
  assert.equal(attachmentMime({type:''}),'application/octet-stream')
  assert.equal(attachmentMime({type:'audio/webm;codecs=opus'}),'audio/webm')
})
