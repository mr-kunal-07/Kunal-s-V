import { useEffect, useState } from 'react'
import { collection, disableNetwork, enableNetwork, onSnapshot, onSnapshotsInSync, query, limit, waitForPendingWrites } from 'firebase/firestore'
import { Modal } from '@carbon/react'
import { Cloud } from '@carbon/icons-react'
import { db, explainError } from './firebase'
import { recoveryStore, reconcileRecovery, syncSignals } from './offline'
import useOnline from './useOnline'
import { folderAccess } from './folder-lock'

export default function OfflineStatus({ user, items = [], unlockedFolders = {} }) {
  const online = useOnline(), [pending, setPending] = useState(false), [cached, setCached] = useState(false), [error, setError] = useState('')
  const [drafts, setDrafts] = useState([]), [showDrafts, setShowDrafts] = useState(false)
  useEffect(() => { (online ? enableNetwork(db) : disableNetwork(db)).catch(failure => setError(explainError(failure))) }, [online])
  useEffect(() => {
    if (!user) { setPending(false); setDrafts([]); return }
    let active = true, revision = 0
    const update = () => { if (active) setDrafts(recoveryStore.list(user.uid)) }
    update()
    const unsubscribeRecovery = recoveryStore.subscribe(update)
    const check = () => {
      const run = ++revision
      setPending(true)
      update()
      waitForPendingWrites(db).then(() => { if (active && run === revision) { setPending(false);update() } }).catch(() => {})
    }
    const stop = onSnapshot(query(collection(db, 'users', user.uid, 'memories'), limit(1)), { includeMetadataChanges:true }, snapshot => { if (active) setCached(snapshot.metadata.fromCache) },failure=>{if(active)setError(explainError(failure))})
    const unsubscribeSignal = syncSignals.subscribe(signal => { if (!active) return; if (signal.error) setError(signal.error); check() })
    const stopSync = onSnapshotsInSync(db, check)
    check()
    return () => { active=false; unsubscribeRecovery(); unsubscribeSignal(); stop(); stopSync() }
  }, [user?.uid])
  useEffect(() => { if (online && user) reconcileRecovery(user.uid).catch(() => {}) }, [online,user?.uid])
  const failed = drafts.filter(draft => draft.error)
  const canRead = draft => {
    if (draft.path.split('/')[2] !== 'memories') return true
    const id = draft.path.split('/').at(-1), existing = items.find(item=>item.id===id)
    const parentId = draft.expected.parentId !== undefined ? draft.expected.parentId : existing?.parentId
    return parentId !== undefined && folderAccess({id,parentId},items,unlockedFolders).allowed
  }
  const label = !online ? 'Offline · saved on this device' : failed.length ? 'Some changes need attention' : pending || drafts.length ? 'Syncing changes…' : cached && user ? 'Connecting to cloud…' : user ? 'All changes synced' : 'Online'
  return <><div className={`offline-status ${!online ? 'is-offline' : ''}`} role="status" aria-live="polite"><Cloud size={14}/><span>{label}</span>{failed.length > 0 && <button type="button" onClick={()=>setShowDrafts(true)}>Recover text ({failed.length})</button>}{error && <button type="button" title={error} onClick={()=>setShowDrafts(true)}>Sync details</button>}</div>{!online && user && <p className="offline-help">Notes and tasks sync automatically when you reconnect. Only previously loaded items are available offline. Uploads and carry-forward need internet.</p>}
    <Modal open={showDrafts} passiveModal modalHeading="Sync details" onRequestClose={()=>setShowDrafts(false)}><p>{error || 'Changes saved on this device will sync when Keep reconnects.'}</p>{drafts.map(draft=><section key={draft.path} className="recovery-draft">{canRead(draft)?<><strong>{draft.title}</strong><p>{draft.error || 'Waiting to sync'}</p><pre>{JSON.stringify(draft.expected,null,2)}</pre>{draft.error&&<button type="button" className="text-link" onClick={()=>{if(window.confirm('Remove this recovery copy? Copy any text you need first. This cannot be undone.'))recoveryStore.remove(draft.path,draft.token)}}>Remove recovery copy</button>}</>:<p>Unlock the note’s folder to view this recovery text.</p>}</section>)}</Modal></>
}
