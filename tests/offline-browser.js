import { auth, db, ownerUid } from '../src/firebase.js'
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth'
import { disableNetwork, enableNetwork, collection, getDocsFromServer, getDocFromCache, getDocsFromCache, waitForPendingWrites, doc, deleteDoc } from 'firebase/firestore'
import { createMemory } from '../src/memories.js'
import { createPlannedTask, tasksFor, schedulesFor } from '../src/daybook-service.js'
import { recoveryStore, reconcileRecovery } from '../src/offline.js'

if (!import.meta.env.DEV || import.meta.env.VITE_FIREBASE_EMULATORS !== 'true') throw new Error('This test requires the explicit local emulator environment.')
const status=document.querySelector('#status')
const assert=(condition,message)=>{if(!condition)throw new Error(message)}
const encode=value=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const ready=new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve()})})
async function connect() {
  await ready
  const now=Math.floor(Date.now()/1000)
  const token=`${encode({alg:'none',typ:'JWT'})}.${encode({iss:'test@example.com',sub:'test@example.com',aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+3600,uid:ownerUid})}.`
  if(!auth.currentUser)await signInWithCustomToken(auth,token)
  assert(auth.currentUser.uid===ownerUid,'Wrong test account')
  if(localStorage.getItem('keep-offline-test-active'))await disableNetwork(db)
  status.textContent='PASS: emulator connected'
}
document.querySelector('#connect').onclick=()=>connect().catch(error=>status.textContent='FAIL: '+error.message)
document.querySelector('#create').onclick=async()=>{
  try {
    await connect();await disableNetwork(db);localStorage.setItem('keep-offline-test-active','true')
    const id=await createMemory(ownerUid,{name:'Offline integration note',kind:'note',content:'Created with no Firestore connection.',noteHtml:'',checklist:[],noteAttachments:[]})
    localStorage.setItem('keep-offline-test-note',id)
    await createPlannedTask(ownerUid,{title:'Offline integration task',date:'2026-11-23',priority:'normal',repeat:'none',weekdays:[]})
    await createPlannedTask(ownerUid,{title:'Offline recurring task',date:'2026-11-23',priority:'high',repeat:'daily',weekdays:[]})
    const snapshot=await getDocFromCache(doc(db,'users',ownerUid,'memories',id))
    assert(snapshot.metadata.hasPendingWrites,'Note must be pending before reconnect')
    status.textContent='PASS: note, one-time task, recurring task and schedule saved locally while disconnected. Reload this page next.'
  }catch(error){status.textContent='FAIL: '+error.message}
}
document.querySelector('#verify').onclick=async()=>{
  try {
    await connect();await disableNetwork(db)
    const id=localStorage.getItem('keep-offline-test-note')
    const note=await getDocFromCache(doc(db,'users',ownerUid,'memories',id))
    const tasks=await getDocsFromCache(tasksFor(ownerUid)),schedules=await getDocsFromCache(schedulesFor(ownerUid))
    assert(note.exists()&&note.metadata.hasPendingWrites,'Persisted note/pending write missing')
    assert(tasks.size===2&&schedules.size===1,'Persisted tasks or schedule missing')
    assert(recoveryStore.list(ownerUid).length===4,'Recovery entries must survive reload')
    status.textContent='PASS: offline note, two tasks, schedule and recovery text survived a full page reload.'
  }catch(error){status.textContent='FAIL: '+error.message}
}
document.querySelector('#sync').onclick=async()=>{
  try {
    await enableNetwork(db);await waitForPendingWrites(db);await reconcileRecovery(ownerUid)
    const notes=await getDocsFromServer(collection(db,'users',ownerUid,'memories')),tasks=await getDocsFromServer(tasksFor(ownerUid)),schedules=await getDocsFromServer(schedulesFor(ownerUid))
    assert(notes.size===1&&tasks.size===2&&schedules.size===1,'Synced objects missing or duplicated')
    assert(recoveryStore.list(ownerUid).length===0,'Synced recovery journal did not clear')
    status.textContent='PASS: reconnected; exactly one note, two tasks and one schedule are in Firestore. Pending recovery journal cleared.'
    await Promise.all([...notes.docs,...tasks.docs,...schedules.docs].map(entry=>deleteDoc(entry.ref)))
    localStorage.removeItem('keep-offline-test-active');localStorage.removeItem('keep-offline-test-note')
    status.textContent+=' Local test data cleaned up.'
  }catch(error){status.textContent='FAIL: '+error.message}
}
