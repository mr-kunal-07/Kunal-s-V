import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pbkdf2Sync } from 'node:crypto'
import { createFolderLock, verifyFolderPassword, folderPasswordError, folderLockToken, folderAccess, visibleFolderItems, requireFolderAccess } from '../src/folder-lock.js'

test('password verifiers use fresh salts, match PBKDF2-SHA-256 and reject incorrect passwords', async () => {
  const password = 'A private folder 🔐', first = await createFolderLock(password), second = await createFolderLock(password)
  assert.notEqual(first.salt, second.salt)
  assert.equal(first.hash, pbkdf2Sync(password, Buffer.from(first.salt, 'hex'), 600000, 32, 'sha256').toString('hex'))
  assert.equal(await verifyFolderPassword(password, first), true)
  assert.equal(await verifyFolderPassword('incorrect password', first), false)
  assert.equal(JSON.stringify(first).includes(password), false)
  assert.deepEqual(Object.keys(first).sort(), ['hash', 'iterations', 'salt', 'version'])
})

test('password validation enforces length and confirmation and fails closed for malformed locks', async () => {
  assert.ok(folderPasswordError('short'))
  assert.ok(folderPasswordError('        '))
  assert.ok(folderPasswordError('x'.repeat(129)))
  assert.ok(folderPasswordError('long enough', 'different'))
  assert.equal(folderPasswordError('long enough', 'long enough'), '')
  await assert.rejects(verifyFolderPassword('password', { version: 2 }), /unsupported/)
})

const lock = { version: 1, iterations: 600000, salt: 'a'.repeat(32), hash: 'b'.repeat(64) }
const items = [
  { id: 'private', name: 'Private', kind: 'folder', parentId: null, folderLock: lock },
  { id: 'nested', name: 'Nested', kind: 'folder', parentId: 'private' },
  { id: 'note', kind: 'note', parentId: 'nested', content: 'Secret search result' },
  { id: 'inner', name: 'Inner', kind: 'folder', parentId: 'private', folderLock: { ...lock, salt: 'c'.repeat(32) } },
  { id: 'file', kind: 'file', parentId: 'inner' },
  { id: 'public', kind: 'folder', parentId: null },
]

test('locked descendants are hidden from all collections and direct nested routes require the outer password', () => {
  assert.deepEqual(visibleFolderItems(items).map(item => item.id), ['private', 'public'])
  assert.equal(folderAccess(items[2], items).folder.id, 'private')
  assert.equal(folderAccess(items[0], items).allowed, false)
  assert.throws(() => requireFolderAccess(items, items), /Unlock “Private”/)
})

test('unlocking a parent reveals contents but separately protected children stay locked', () => {
  const unlocked = { private: folderLockToken(lock) }
  assert.deepEqual(visibleFolderItems(items, unlocked).map(item => item.id), ['private', 'nested', 'note', 'inner', 'public'])
  assert.equal(folderAccess(items[2], items, unlocked).allowed, true)
  assert.equal(folderAccess(items[4], items, unlocked).folder.id, 'inner')
  assert.throws(() => requireFolderAccess(items, items, unlocked), /Unlock “Inner”/)
  const allUnlocked = { ...unlocked, inner: folderLockToken(items[3].folderLock) }
  assert.doesNotThrow(() => requireFolderAccess(items, items, allUnlocked))
  assert.deepEqual(visibleFolderItems(items, allUnlocked), items)
})

test('changed verifiers, missing ancestors and folder cycles never reuse access or expose contents', () => {
  const unlocked = { private: folderLockToken(lock) }
  const changed = items.map(item => item.id === 'private' ? { ...item, folderLock: { ...lock, hash: 'd'.repeat(64) } } : item)
  assert.equal(folderAccess(changed[2], changed, unlocked).allowed, false)
  assert.deepEqual(visibleFolderItems([items[2]], unlocked), [])
  const cycle = [{ id: 'a', kind: 'folder', parentId: 'b' }, { id: 'b', kind: 'folder', parentId: 'a' }]
  assert.equal(folderAccess(cycle[0], cycle).allowed, false)
  assert.throws(() => requireFolderAccess([items[2]], [items[2]], unlocked), /unavailable/)
})
