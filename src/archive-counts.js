export function archiveSummary(items) {
  const activeItems = items.filter(item => !item.deletedAt), trashItems = items.filter(item => item.deletedAt)
  const folders = activeItems.filter(item => item.kind === 'folder')
  const files = activeItems.filter(item => item.kind === 'file')
  const index = new Map(items.map(item => [item.id, item])), folderCounts = new Map()
  for (const item of items) {
    const parent = index.get(item.parentId)
    if (parent?.kind === 'folder' && Boolean(parent.deletedAt) === Boolean(item.deletedAt)) {
      folderCounts.set(parent.id, (folderCounts.get(parent.id) || 0) + 1)
    }
  }
  return {
    activeItems, trashItems, folders, files, folderCounts,
    counts: {
      all: activeItems.filter(item => !item.parentId).length,
      favorites: activeItems.filter(item => item.favorite).length,
      notes: activeItems.filter(item => item.kind === 'note').length,
      links: activeItems.filter(item => item.kind === 'link').length,
      files: files.length,
      trash: trashItems.length,
    },
  }
}

export function countLabel(count, { loading = false, partial = false, error = false } = {}) {
  if (error) return '—'
  if (loading) return '…'
  return `${count}${partial ? '+' : ''}`
}

export function folderCountLabel(count, options) {
  return `${countLabel(count, options)} ${count === 1 && !options?.partial ? 'item' : 'items'}`
}
