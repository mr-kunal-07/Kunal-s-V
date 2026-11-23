import { visibleFolderItems } from './folder-lock.js'
import { tasksForDay } from './daybook-utils.js'

const milliseconds = value => value?.toMillis?.() || 0
const recentFirst = (a, b) => milliseconds(b.updatedAt || b.createdAt) - milliseconds(a.updatedAt || a.createdAt) || a.name.localeCompare(b.name)

export function homeSummary(items, tasks, date, unlockedFolders = {}) {
  const index = new Map(items.map(item => [item.id, item]))
  const active = visibleFolderItems(items, unlockedFolders).filter(item => {
    let current = item
    const seen = new Set()
    while (current) {
      if (current.deletedAt || seen.has(current.id)) return false
      seen.add(current.id)
      current = current.parentId ? index.get(current.parentId) : null
    }
    return true
  })
  const today = tasksForDay(tasks, date).sort((a, b) => Number(a.done) - Number(b.done)
    || Number(b.priority === 'high') - Number(a.priority === 'high')
    || milliseconds(a.createdAt) - milliseconds(b.createdAt) || a.id.localeCompare(b.id))
  const notes = active.filter(item => item.kind === 'note').sort(recentFirst)
  const folders = active.filter(item => item.kind === 'folder' && item.pinned).sort(recentFirst)
  const completed = today.filter(task => task.done).length
  return { tasks: today.slice(0, 5), total: today.length, completed, pending: today.length - completed,
    notes: notes.slice(0, 3), folders: folders.slice(0, 6) }
}
