import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentBytes } from '../src/storage-size.js'
test('includes note data and attachments and counts shared blobs once',()=>{
 const note={kind:'note',content:'Hello',noteHtml:'<b>Hello</b>',noteAttachments:[{storagePath:'a',size:100}]}
 assert.ok(contentBytes([note])>100)
 assert.equal(contentBytes([note,{kind:'file',storagePath:'a',size:100}]),contentBytes([note]))
 assert.equal(contentBytes([{kind:'folder'}]),0)
})
test('measures Unicode as UTF-8 bytes',()=>{
 assert.ok(contentBytes([{kind:'note',content:'你好'}])>contentBytes([{kind:'note',content:'ab'}]))
})
