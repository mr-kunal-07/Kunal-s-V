import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction, getDocFromCache } from 'firebase/firestore'
import { ref, uploadBytesResumable, deleteObject, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import { validateOriginalImage } from './image-upload'
import { cachedWrite, isOffline, requireInternet } from './offline'
export const memoriesCollection = uid => collection(db, 'users', uid, 'memories')
const memoryRef = (uid, id) => doc(memoriesCollection(uid), id)
export async function createMemory(uid, data, options) {
  const target = doc(memoriesCollection(uid))
  const values = { parentId: null, favorite: false, ...data }
  await cachedWrite([target], () => setDoc(target, { ...values, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), data.kind === 'note' ? [{ target, data: values, title: data.name }] : [], options)
  return target.id
}
export const updateMemory = (uid, id, data, options) => {
  const target = memoryRef(uid, id)
  return cachedWrite([target], () => updateDoc(target, { ...data, updatedAt: serverTimestamp() }), 'content' in data ? [{ target, data, title: data.name || 'Note' }] : [], options)
}
export async function removeMemory(uid, item) {
  requireInternet('Permanently deleting files')
  for (const attachment of item.noteAttachments || []) await deleteNoteAttachment(attachment)
  if (item.storagePath) {
    try { await deleteObject(ref(storage, item.storagePath)) }
    catch (error) { if (error.code !== 'storage/object-not-found') throw error }
  }
  await deleteDoc(memoryRef(uid, item.id))
}
export const openFile = item => getDownloadURL(ref(storage, item.storagePath))
export async function uploadFile(uid, file, parentId, onProgress) {
  requireInternet('Uploading files')
  if (file.type?.startsWith('image/')) validateOriginalImage(file)
  if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} exceeds the 100 MB file limit.`)
  const target = doc(memoriesCollection(uid))
  const storagePath = `users/${uid}/${target.id}/${file.name}`
  // Upload the original bytes, including full resolution and embedded image metadata.
  const task = uploadBytesResumable(ref(storage, storagePath), file, { contentType: file.type || 'application/octet-stream' })
  await new Promise((resolve, reject) => task.on('state_changed', s => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 1), reject, resolve))
  try { await setDoc(target, { name: file.name, kind: 'file', parentId, storagePath, size: file.size, mimeType: file.type, favorite: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }) }
  catch (error) { await deleteObject(ref(storage, storagePath)).catch(() => {}); throw error }
}

export { droppedFiles, fileSize } from './archive-utils.js'

export async function uploadNoteAttachment(uid, item) {
  requireInternet('Uploading attachments')
  if (item.file.type?.startsWith('image/')) validateOriginalImage(item.file)
  const name = item.name.replace(/[\\/]/g, '_')
  const storagePath = `users/${uid}/${crypto.randomUUID()}/${name}`
  const task = uploadBytesResumable(ref(storage,storagePath),item.file,{contentType:item.file.type || item.mimeType})
  await new Promise((resolve,reject)=>task.on('state_changed',undefined,reject,resolve))
  return {id:item.id,name,mimeType:item.mimeType,size:item.size,storagePath}
}
export async function deleteNoteAttachment(item) {
 requireInternet('Removing stored attachments')
 try { await deleteObject(ref(storage,item.storagePath)) } catch(error) { if(error.code !== 'storage/object-not-found')throw error }
}


export async function setChecklistChecked(uid, memoryId, rowId, checked) {
 if (isOffline()) {
  const target = memoryRef(uid, memoryId), snapshot = await getDocFromCache(target), note = snapshot.data()
  if (!note || note.deletedAt) throw new Error('Open an available note before changing its checklist offline.')
  if (!(note.checklist || []).some(row => row.id === rowId)) throw new Error('This checklist item was removed. Reopen the note.')
  const checklist = note.checklist.map(row => row.id === rowId ? { ...row, checked } : row)
  await updateMemory(uid, memoryId, { checklist }); return checklist
 }
 return runTransaction(db, async transaction => {
  const target=memoryRef(uid,memoryId), snapshot=await transaction.get(target)
  if(!snapshot.exists())throw new Error('This note no longer exists.')
  const note=snapshot.data()
  if(note.deletedAt)throw new Error('Restore this note from Trash before checking items.')
  if(!(note.checklist||[]).some(row=>row.id===rowId))throw new Error('This checklist item was removed. Reopen the note to refresh it.')
  const checklist=note.checklist.map(row=>row.id===rowId?{...row,checked}:row)
  transaction.update(target,{checklist,updatedAt:serverTimestamp()})
  return checklist
 })
}
