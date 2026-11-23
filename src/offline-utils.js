// Local acknowledgement is separate from the server acknowledgement: Firestore
// write promises intentionally stay pending while offline.
export async function acknowledgeCachedWrite(remote, readLocal) {
  let rejected
  const server = remote.then(() => ({ pending: false }), error => { rejected = error; throw error })
  const local = Promise.resolve().then(readLocal).then(snapshots => {
    if (rejected) throw rejected
    return snapshots.every(snapshot => snapshot.metadata.hasPendingWrites) ? { pending: true } : server
  }, () => server)
  return Promise.race([server, local])
}

export function recoveryMatches(data, expected) {
  if (!data) return false
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value
  return Object.entries(expected).every(([key, value]) => JSON.stringify(stable(data[key])) === JSON.stringify(stable(value)))
}

export function mergeLocalItems(items, recent) {
  const result = new Map(items.map(item => [item.id,item]))
  for (const item of recent) if (item._pending || !result.has(item.id)) result.set(item.id,item)
  return [...result.values()]
}

export function createRecoveryStore(storage) {
  const key = 'keep-sync-recovery-v1'
  const listeners = new Set()
  const read = () => { try { const values = JSON.parse(storage?.getItem(key) || '[]'); return Array.isArray(values) ? values : [] } catch { return [] } }
  const write = values => { storage?.setItem(key, JSON.stringify(values)); listeners.forEach(listener => listener()) }
  return {
    list: uid => read().filter(item => item.uid === uid),
    add: item => write([...read().filter(current => current.path !== item.path || current.uid !== item.uid), item]),
    remove: (path, token) => write(read().filter(item => item.path !== path || item.token !== token)),
    fail: (path, token, error) => write(read().map(item => item.path === path && item.token === token ? { ...item, error } : item)),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  }
}
