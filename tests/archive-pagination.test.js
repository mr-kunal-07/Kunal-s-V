import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archiveWindow, readArchivePages } from '../src/archive-pagination.js'
test('bounded initial window uses the extra record only as a more-results marker',()=>{
 const docs=Array.from({length:26},(_,id)=>({id:String(id)}))
 assert.equal(archiveWindow(docs,25).items.length,25)
 assert.equal(archiveWindow(docs,25).hasMore,true)
 assert.equal(archiveWindow(docs.slice(0,25),25).hasMore,false)
})
test('full operations follow cursors and include all descendants without duplicate records',async()=>{
 const cursors=[]
 const result=await readArchivePages(async cursor=>{cursors.push(cursor);return cursor===null?{items:[{id:'folder'},{id:'child'}],hasMore:true,cursor:'child'}:{items:[{id:'child'},{id:'nested'}],hasMore:false,cursor:'nested'}})
 assert.deepEqual(cursors,[null,'child'])
 assert.deepEqual(result.map(i=>i.id),['folder','child','nested'])
})
test('cancels account changes and propagates page failures',async()=>{
 await assert.rejects(readArchivePages(async()=>({items:[],hasMore:false}),()=>false),/Archive changed/)
 await assert.rejects(readArchivePages(async()=>{throw new Error('permission denied')}),/permission denied/)
})
test('rejects stuck cursors instead of looping indefinitely',async()=>{
 await assert.rejects(readArchivePages(async()=>({items:[],hasMore:true,cursor:'same'})),/did not advance/)
})
