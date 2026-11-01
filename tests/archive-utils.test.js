import { test } from 'node:test'
import assert from 'node:assert/strict'
import { droppedFiles, fileSize } from '../src/archive-utils.js'
const file = name => ({ isFile: true, name, file: resolve => resolve({ name, size: 10 }) })
function directory(name, batches) {
  return { isFile: false, name, createReader: () => { let i = 0; return { readEntries: resolve => resolve(batches[i++] || []) } } }
}
test('folder drop preserves nested paths, empty folders, and all directory batches', async () => {
  const firstBatch = Array.from({ length: 100 }, (_, i) => file(`photo-${i}.jpg`))
  const root = directory('Memories', [firstBatch, [file('last.txt'), directory('Empty', []), directory('Letters', [[file('hello.txt')]])]])
  const result = await droppedFiles({ items: [{ webkitGetAsEntry: () => root }] })
  assert.equal(result.filter(item => item.file).length, 102)
  assert.ok(result.some(item => item.directory === 'Memories/Empty'))
  assert.ok(result.some(item => item.path === 'Memories/Letters/hello.txt'))
  assert.ok(result.some(item => item.path === 'Memories/last.txt'))
})
test('falls back to files when directory entry APIs are unavailable', async () => {
  const files = [{ name: 'a.txt' }, { name: 'image.png' }]
  assert.deepEqual(await droppedFiles({ items: [], files }), files.map(file => ({ file, path: file.name })))
})
test('surfaces unreadable directory errors', async () => {
  const entry = { isFile: false, name: 'Locked', createReader: () => ({ readEntries: (_, reject) => reject(new Error('Denied')) }) }
  await assert.rejects(droppedFiles({ items: [{ webkitGetAsEntry: () => entry }] }), /Denied/)
})
test('formats zero bytes and file sizes', () => {
  assert.equal(fileSize(0), '0 B')
  assert.equal(fileSize(1024), '1.0 KB')
  assert.equal(fileSize(1048576), '1.0 MB')
})
