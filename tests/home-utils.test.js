import test from 'node:test'
import assert from 'node:assert/strict'
import { homeSummary } from '../src/home-utils.js'
import { folderLockToken } from '../src/folder-lock.js'

const timestamp = value => ({ toMillis: () => value })
const note = (id, updated, extra = {}) => ({ id, name: id, kind: 'note', parentId: null, updatedAt: timestamp(updated), ...extra })

test('Home never exposes notes or pinned descendants of locked, missing or trashed folders', () => {
  const lock = { version: 1, iterations: 600000, salt: 'a'.repeat(32), hash: 'b'.repeat(64) }
  const items = [
    { id: 'locked', name: 'Private', kind: 'folder', parentId: null, pinned: true, folderLock: lock },
    note('private-note', 100, { parentId: 'locked' }),
    { id: 'nested', name: 'Nested private folder', kind: 'folder', parentId: 'locked', pinned: true },
    { id: 'trashed', name: 'Old', kind: 'folder', parentId: null, deletedAt: timestamp(1), pinned: true },
    note('trashed-child', 90, { parentId: 'trashed' }),
    note('missing-parent', 80, { parentId: 'unknown' }),
    note('visible-note', 10), note('deleted-note', 200, { deletedAt: timestamp(1) }),
  ]
  const locked = homeSummary(items, [], '2026-11-24')
  assert.deepEqual(locked.notes.map(item => item.id), ['visible-note'])
  assert.deepEqual(locked.folders.map(item => item.id), ['locked'])
  const unlocked = homeSummary(items, [], '2026-11-24', { locked: folderLockToken(lock) })
  assert.deepEqual(unlocked.notes.map(item => item.id), ['private-note', 'visible-note'])
  assert.deepEqual(new Set(unlocked.folders.map(item => item.id)), new Set(['locked', 'nested']))
})

test('Home counts the whole current day while showing a compact list with pending high-priority tasks first', () => {
  const date = '2026-11-24'
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: String(index), title: `Task ${index}`, date, done: index < 2, priority: index === 6 ? 'high' : 'normal', createdAt: timestamp(index) }))
  tasks.push({ id: 'yesterday', date: '2026-11-23', done: false }, { id: 'suppressed', date, suppressed: true, done: false })
  const summary = homeSummary([], tasks, date)
  assert.equal(summary.total, 7); assert.equal(summary.pending, 5); assert.equal(summary.completed, 2)
  assert.deepEqual(summary.tasks.map(task => task.id), ['6', '2', '3', '4', '5'])
  assert.equal(tasks.length, 9, 'the shared Day Book data must not be mutated')
})

test('Home recent notes and pinned folders use update time and stay within their compact limits', () => {
  const items = Array.from({ length: 9 }, (_, index) => note(`note-${index}`, index))
  items.push(...Array.from({ length: 8 }, (_, index) => ({ id: `folder-${index}`, name: `Folder ${index}`, kind: 'folder', parentId: null, pinned: true, updatedAt: timestamp(index) })))
  items.push({ id: 'favorite', name: 'Favorite only', kind: 'folder', parentId: null, favorite: true, updatedAt: timestamp(999) })
  const summary = homeSummary(items, [], '2026-11-24')
  assert.deepEqual(summary.notes.map(item => item.id), ['note-8', 'note-7', 'note-6'])
  assert.equal(summary.folders.length, 6)
  assert.equal(summary.folders[0].id, 'folder-7')
  assert.ok(!summary.folders.some(item => item.id === 'favorite'))
})
