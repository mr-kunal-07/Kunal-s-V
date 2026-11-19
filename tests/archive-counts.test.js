import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archiveSummary, countLabel, folderCountLabel } from '../src/archive-counts.js'
import { folderAccess, folderLockToken, visibleFolderItems } from '../src/folder-lock.js'

const roots = Array.from({ length: 5 }, (_, index) => ({ id: `root${index}`, name: `Folder ${index}`, kind: 'folder', parentId: null }))
const items = [...roots,
  { id: 'nested1', kind: 'folder', parentId: 'root0' },
  { id: 'nested2', kind: 'folder', parentId: 'nested1' },
  ...['root0', 'nested1', 'root1', 'nested2', 'root3'].map((parentId, index) => ({ id: `note${index}`, kind: 'note', parentId })),
]

test('All memories matches five root folders rather than twelve total archive records', () => {
  const summary = archiveSummary(items)
  assert.equal(summary.activeItems.length, 12)
  assert.equal(summary.counts.all, 5)
  assert.equal(summary.counts.notes, 5)
  assert.equal(summary.folderCounts.get('root0'), 2)
  assert.equal(summary.folderCounts.get('nested1'), 2)
  assert.equal(summary.folderCounts.get('nested2'), 1)
  assert.equal(summary.folderCounts.get('root2') || 0, 0)
})

test('folder counts match direct contents and separate active records from Trash', () => {
  const summary = archiveSummary([...items,
    { id: 'deleted-note', kind: 'note', parentId: 'root0', deletedAt: true },
    { id: 'deleted-folder', kind: 'folder', parentId: null, deletedAt: true },
    { id: 'deleted-child', kind: 'file', parentId: 'deleted-folder', deletedAt: true },
  ])
  assert.equal(summary.counts.all, 5)
  assert.equal(summary.counts.notes, 5)
  assert.equal(summary.counts.trash, 3)
  assert.equal(summary.folderCounts.get('root0'), 2)
  assert.equal(summary.folderCounts.get('deleted-folder'), 1)
})

test('root notes/files/links and global filter badges count the records their views show', () => {
  const summary = archiveSummary([...items,
    { id: 'root-note', kind: 'note', parentId: null, favorite: true },
    { id: 'root-file', kind: 'file', parentId: null },
    { id: 'nested-file', kind: 'file', parentId: 'root0', favorite: true },
    { id: 'link', kind: 'link', parentId: 'root0' },
  ])
  assert.deepEqual(summary.counts, { all: 7, favorites: 2, notes: 6, links: 1, files: 2, trash: 0 })
})

test('locked descendants stay absent from filter and folder counts until the folder is unlocked', () => {
  const folderLock = { version: 1, iterations: 600000, salt: 'a'.repeat(32), hash: 'b'.repeat(64) }
  const protectedItems = items.map(item => item.id === 'root0' ? { ...item, folderLock } : item)
  const locked = archiveSummary(visibleFolderItems(protectedItems))
  assert.equal(locked.counts.all, 5)
  assert.equal(locked.counts.notes, 2)
  assert.equal(folderAccess(protectedItems[0], protectedItems).allowed, false)
  const unlocked = archiveSummary(visibleFolderItems(protectedItems, { root0: folderLockToken(folderLock) }))
  assert.equal(unlocked.counts.notes, 5)
  assert.equal(unlocked.folderCounts.get('root0'), 2)
})

test('partial, loading and failed counts never appear as complete zero totals', () => {
  assert.equal(countLabel(5), '5')
  assert.equal(countLabel(5, { partial: true }), '5+')
  assert.equal(countLabel(0, { loading: true }), '…')
  assert.equal(countLabel(0, { error: true }), '—')
  assert.equal(folderCountLabel(1), '1 item')
  assert.equal(folderCountLabel(2), '2 items')
  assert.equal(folderCountLabel(1, { partial: true }), '1+ items')
})
