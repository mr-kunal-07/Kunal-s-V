import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandSelection, selectionRoots, makeZip } from '../src/bulk-utils.js'
const items=[{id:'a',kind:'folder',name:'Folder',parentId:null},{id:'b',kind:'folder',name:'Sub',parentId:'a'},{id:'c',kind:'note',name:'Note',parentId:'b'},{id:'d',kind:'file',name:'Photo',parentId:null}]
test('bulk folders include descendants once',()=>{
 assert.deepEqual(expandSelection([items[0],items[2]],items).map(i=>i.id),['a','b','c'])
 assert.deepEqual(selectionRoots([items[0],items[2],items[3]],items).map(i=>i.id),['a','d'])
})
test('ZIP headers, UTF-8 flags, offsets and contents are valid',async()=>{
 const zip=makeZip([{name:'note.txt',bytes:new TextEncoder().encode('hello')},{name:'Empty/',bytes:new Uint8Array()}])
 const bytes=new Uint8Array(await zip.arrayBuffer()),view=new DataView(bytes.buffer)
 assert.equal(view.getUint32(0,true),0x04034b50)
 assert.equal(view.getUint16(6,true),0x800)
 assert.equal(view.getUint32(14,true),0x3610a686)
 assert.equal(new TextDecoder().decode(bytes.slice(38,43)),'hello')
 const end=bytes.length-22
 assert.equal(view.getUint32(end,true),0x06054b50)
 assert.equal(view.getUint16(end+10,true),2)
 const central=view.getUint32(end+16,true)
 assert.equal(view.getUint32(central,true),0x02014b50)
 assert.equal(view.getUint32(central+42,true),0)
 assert.equal(view.getUint32(end+12,true),bytes.length-22-central)
})
