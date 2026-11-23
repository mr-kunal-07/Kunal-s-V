import { writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { memoriesCollection } from './memories'
import { doc } from 'firebase/firestore'
import { expandSelection } from './bulk-utils'
import { requireInternet } from './offline'
export async function setTrashed(uid, selected, items, trashed) {
  requireInternet('Changing Trash')
  const targets = expandSelection(selected, items)
  if (!trashed) {
    const ids = new Set(targets.map(i => i.id))
    for (const item of [...targets]) {
      let id = item.parentId
      while (id && !ids.has(id)) { const parent = items.find(i => i.id === id); if (!parent) break; ids.add(id); if(parent.deletedAt) targets.push(parent); id = parent.parentId }
    }
  }
  if (targets.length > 400) throw new Error('Select up to 400 items including folder contents per operation.')
  const batch = writeBatch(db)
  for (const item of targets) batch.update(doc(memoriesCollection(uid), item.id), { deletedAt: trashed ? serverTimestamp() : null, updatedAt: serverTimestamp() })
  await batch.commit()
  return targets.map(i => i.id)
}
