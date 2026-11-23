import { doc, getDocFromCache, getDocFromServer, waitForPendingWrites } from 'firebase/firestore'
import { auth, db, explainError } from './firebase'
import { acknowledgeCachedWrite, createRecoveryStore, recoveryMatches } from './offline-utils'

let browserStorage
try { browserStorage = window.localStorage } catch { /* Firestore still manages its own IndexedDB queue. */ }
export const recoveryStore = createRecoveryStore(browserStorage)
const signals = new Set()
export const syncSignals = {
  subscribe(callback) { signals.add(callback); return () => signals.delete(callback) },
  emit(value) { signals.forEach(callback => callback(value)) },
}
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
export function requireInternet(action) { if (isOffline()) throw new Error(`${action} needs an internet connection. Notes and tasks can still be saved offline.`) }

// Native Firestore mutations remain the only sync queue. This small journal keeps
// recoverable text if a later server-side permission/validation failure rejects one.
export async function cachedWrite(targets, commit, recovery, { waitForServer = false } = {}) {
  const records = (recovery || []).map(({ target, data, title }) => ({ uid: auth.currentUser?.uid, path: target.path, token: crypto.randomUUID(), title, expected: data, savedAt: Date.now() }))
  for (const record of records) recoveryStore.add(record)
  let remote
  try { remote = Promise.resolve(commit()) }
  catch (error) { for (const record of records) recoveryStore.remove(record.path, record.token); throw error }
  syncSignals.emit({ pending:true })
  remote.then(() => {
    for (const record of records) recoveryStore.remove(record.path, record.token)
    syncSignals.emit({ synced: true })
  }, error => {
    for (const record of records) recoveryStore.fail(record.path, record.token, explainError(error))
    syncSignals.emit({ error: explainError(error) })
  })
  return waitForServer ? remote.then(()=>({pending:false})) : acknowledgeCachedWrite(remote, () => Promise.all(targets.map(target => getDocFromCache(target))))
}

// A page reload loses JS promises, but not Firestore's durable mutation queue.
// Reconcile the recovery journal only after that restored queue finishes.
export async function reconcileRecovery(uid) {
  if (isOffline() || !recoveryStore.list(uid).length) return
  await waitForPendingWrites(db)
  for (const record of recoveryStore.list(uid)) {
    if (auth.currentUser?.uid !== uid || isOffline()) return
    try {
      const snapshot = await getDocFromServer(doc(db, record.path))
      if (recoveryMatches(snapshot.data(), record.expected)) recoveryStore.remove(record.path, record.token)
      else recoveryStore.fail(record.path, record.token, 'The cloud has a different version of this change. Your text is kept below so you can recover it.')
    } catch (error) {
      if (error.code === 'permission-denied') recoveryStore.fail(record.path, record.token, explainError(error))
    }
  }
}
