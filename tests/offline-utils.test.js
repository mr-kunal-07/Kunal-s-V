import test from 'node:test'
import assert from 'node:assert/strict'
import { acknowledgeCachedWrite, createRecoveryStore, recoveryMatches, mergeLocalItems } from '../src/offline-utils.js'

test('offline save completes after the local cache confirms it without waiting for server', async () => {
  let resolveServer
  const remote = new Promise(resolve=>{resolveServer=resolve})
  const result = await acknowledgeCachedWrite(remote,async()=>[{metadata:{hasPendingWrites:true}}])
  assert.equal(result.pending,true)
  resolveServer()
})
test('a cache read failure is never reported as a durable local save', async () => {
  const error = new Error('storage unavailable')
  await assert.rejects(acknowledgeCachedWrite(Promise.reject(error),async()=>{throw error}),/storage unavailable/)
})
test('immediate rejected writes remain errors, and successful server writes complete normally',async()=>{
  await assert.rejects(acknowledgeCachedWrite(Promise.reject(new Error('denied')),async()=>[{metadata:{hasPendingWrites:true}}]),/denied/)
  assert.equal((await acknowledgeCachedWrite(Promise.resolve(),async()=>[{metadata:{hasPendingWrites:false}}])).pending,false)
})
test('all batch documents must be acknowledged before a local-only save completes', async () => {
  let resolveServer,completed=false
  const remote = new Promise(resolve=>{resolveServer=resolve})
  const result = acknowledgeCachedWrite(remote,async()=>[{metadata:{hasPendingWrites:true}},{metadata:{hasPendingWrites:false}}]).then(value=>{completed=true;return value})
  await new Promise(resolve=>setTimeout(resolve,5)); assert.equal(completed,false)
  resolveServer(); assert.equal((await result).pending,false)
})
test('recovery records survive reload and late acknowledgement cannot erase a newer edit',()=>{
  let value='[]';const storage={getItem:()=>value,setItem:(_,next)=>{value=next}}
  const store=createRecoveryStore(storage)
  store.add({uid:'owner',path:'notes/one',token:'first',expected:{content:'earlier'}})
  store.add({uid:'owner',path:'notes/one',token:'second',expected:{content:'latest'}})
  store.remove('notes/one','first')
  const reloaded=createRecoveryStore(storage)
  assert.equal(reloaded.list('owner')[0].expected.content,'latest'); assert.equal(reloaded.list('another-owner').length,0)
  reloaded.fail('notes/one','second','permission denied'); assert.equal(store.list('owner')[0].error,'permission denied')
  reloaded.remove('notes/one','second');assert.equal(store.list('owner').length,0)
})
test('reconciliation handles unordered Firestore maps and preserves conflicting cloud data',()=>{
  assert.ok(recoveryMatches({checklist:[{checked:false,text:'task',id:'1'}],updatedAt:'server'},{checklist:[{id:'1',text:'task',checked:false}]}))
  assert.equal(recoveryMatches({content:'cloud edit'},{content:'offline edit'}),false)
})
test('new pending notes remain visible outside the initial archive page without duplicate rows',()=>{
  const merged=mergeLocalItems([{id:'one',content:'old'}],[{id:'one',content:'edited',_pending:true},{id:'two',content:'new',_pending:true}])
  assert.equal(merged.length,2);assert.equal(merged[0].content,'edited');assert.equal(merged[1].content,'new')
})
