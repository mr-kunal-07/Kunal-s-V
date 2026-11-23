// Integration check using the actual app services and an IndexedDB test adapter.
// Requires local Auth :9099 and Firestore :8088 emulators. Never contacts the cloud.
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { signInWithCustomToken } from 'firebase/auth'
import { disableNetwork, enableNetwork, getDocFromCache, getDocsFromCache, getDocsFromServer, waitForPendingWrites, doc, collection, deleteDoc, terminate } from 'firebase/firestore'
import { deleteApp } from 'firebase/app'

const values=new Map()
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size}}
const events=new EventTarget()
globalThis.window={localStorage:storage,sessionStorage:storage,indexedDB,location:{href:'http://127.0.0.1:5184/',protocol:'http:'},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)}
globalThis.document={visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}}
globalThis.self=globalThis
globalThis.localStorage=storage
process.env.VITE_FIREBASE_EMULATORS='true'
process.env.USE_MOCK_PERSISTENCE='YES'
let server=await createServer({server:{middlewareMode:true},appType:'custom'})
const timeout=setTimeout(()=>{console.error('FAIL: offline emulator check timed out');process.exit(1)},45000)
let db,auth
try {
  let firebase=await server.ssrLoadModule('/src/firebase.js');db=firebase.db;auth=firebase.auth
  const {createMemory}=await server.ssrLoadModule('/src/memories.js')
  let {createPlannedTask,tasksFor,schedulesFor}=await server.ssrLoadModule('/src/daybook-service.js')
  let {recoveryStore,reconcileRecovery}=await server.ssrLoadModule('/src/offline.js')
  const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
  const token=`${encode({alg:'none',typ:'JWT'})}.${encode({iss:'emulator@test.local',sub:'emulator@test.local',aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+3600,uid:firebase.ownerUid})}.`
  await signInWithCustomToken(auth,token)
  await disableNetwork(db)
  const noteId=await createMemory(firebase.ownerUid,{name:'Offline integration note',kind:'note',content:'Saved offline',noteHtml:'',checklist:[],noteAttachments:[]})
  await createPlannedTask(firebase.ownerUid,{title:'Offline integration task',date:'2026-11-23',priority:'normal',repeat:'none',weekdays:[]})
  await createPlannedTask(firebase.ownerUid,{title:'Offline recurring task',date:'2026-11-23',priority:'high',repeat:'daily',weekdays:[]})
  const note=await getDocFromCache(doc(db,'users',firebase.ownerUid,'memories',noteId))
  assert.equal(note.metadata.hasPendingWrites,true)
  assert.equal((await getDocsFromCache(tasksFor(firebase.ownerUid))).size,2)
  assert.equal((await getDocsFromCache(schedulesFor(firebase.ownerUid))).size,1)
  assert.equal(recoveryStore.list(firebase.ownerUid).length,4)
  console.log('PASS: actual note/task services acknowledged offline writes after IndexedDB persistence, including an atomic recurring schedule.')
  const databases=await indexedDB.databases()
  assert.ok(databases.some(database=>database.name.includes('firestore')),'Firestore must have opened an IndexedDB database')
  await terminate(db);await deleteApp(auth.app);await server.close()
  server=await createServer({server:{middlewareMode:true},appType:'custom'})
  firebase=await server.ssrLoadModule('/src/firebase.js');db=firebase.db;auth=firebase.auth
  ;({tasksFor,schedulesFor}=await server.ssrLoadModule('/src/daybook-service.js'))
  ;({recoveryStore,reconcileRecovery}=await server.ssrLoadModule('/src/offline.js'))
  await disableNetwork(db);await signInWithCustomToken(auth,token)
  assert.equal((await getDocFromCache(doc(db,'users',firebase.ownerUid,'memories',noteId))).metadata.hasPendingWrites,true)
  assert.equal((await getDocsFromCache(tasksFor(firebase.ownerUid))).size,2)
  assert.equal((await getDocsFromCache(schedulesFor(firebase.ownerUid))).size,1)
  assert.equal(recoveryStore.list(firebase.ownerUid).length,4)
  console.log('PASS: replacing the app/Firestore instance preserved the pending note, tasks, schedule, and recovery journal in the IndexedDB adapter.')
  await enableNetwork(db);await waitForPendingWrites(db);await reconcileRecovery(firebase.ownerUid)
  const notes=await getDocsFromServer(collection(db,'users',firebase.ownerUid,'memories'))
  const tasks=await getDocsFromServer(tasksFor(firebase.ownerUid)),schedules=await getDocsFromServer(schedulesFor(firebase.ownerUid))
  assert.equal(notes.size,1);assert.equal(tasks.size,2);assert.equal(schedules.size,1);assert.equal(recoveryStore.list(firebase.ownerUid).length,0)
  console.log('PASS: reconnect synchronized exactly one note, two tasks, and one schedule, with no duplicates. Recovery journal cleared.')
  await Promise.all([...notes.docs,...tasks.docs,...schedules.docs].map(entry=>deleteDoc(entry.ref)))
  await disableNetwork(db)
  const {createMemory:createRejectedNote}=await server.ssrLoadModule('/src/memories.js')
  const rejectedId=await createRejectedNote(firebase.ownerUid,{name:'Rejected offline draft',kind:'note',content:'Recover this text',invalidField:true})
  assert.equal((await getDocFromCache(doc(db,'users',firebase.ownerUid,'memories',rejectedId))).metadata.hasPendingWrites,true)
  await enableNetwork(db);await waitForPendingWrites(db);await reconcileRecovery(firebase.ownerUid)
  const rejectedDraft=recoveryStore.list(firebase.ownerUid).find(item=>item.path.endsWith(rejectedId))
  assert.ok(rejectedDraft?.error);assert.equal(rejectedDraft.expected.content,'Recover this text')
  recoveryStore.remove(rejectedDraft.path,rejectedDraft.token)
  assert.equal((await getDocsFromServer(collection(db,'users',firebase.ownerUid,'memories'))).size,0)
  console.log('PASS: a rejected sync retained recoverable text and showed an error instead of silently losing the offline draft.')
  console.log('PASS: local emulator data cleaned up. No production writes.')
} finally {
  clearTimeout(timeout)
  if(db)await terminate(db)
  if(auth)await deleteApp(auth.app)
  await server.close()
}
