import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canMoveTo, parseTags, matchesMemory, previewKind } from '../src/memory-features.js'
const items = [{ id:'a',kind:'folder',parentId:null }, { id:'b',kind:'folder',parentId:'a' }, { id:'c',kind:'folder',parentId:'b' }, { id:'d',kind:'folder',parentId:null }]
test('moving prevents self, descendants and nonexistent destinations', () => {
  assert.equal(canMoveTo(items[0], 'a', items), false)
  assert.equal(canMoveTo(items[0], 'c', items), false)
  assert.equal(canMoveTo(items[0], 'missing', items), false)
  assert.equal(canMoveTo(items[0], 'd', items), true)
  assert.equal(canMoveTo(items[1], null, items), true)
})
test('cyclic destination paths are rejected', () => {
  assert.equal(canMoveTo(items[0], 'x', [{id:'x',kind:'folder',parentId:'y'},{id:'y',kind:'folder',parentId:'x'}]), false)
})
test('tags normalize and enforce limits', () => {
  assert.deepEqual(parseTags(' Family, family, Birthday, , '), ['family','birthday'])
  assert.throws(() => parseTags('x'.repeat(51)))
  assert.throws(() => parseTags(Array.from({length:21},(_,i) => `tag${i}`).join(',')))
})
test('search finds memory dates, people and occasions', () => {
  const memory = {name:'Photo',memoryDate:'2022-08-01',tags:['kunal','birthday']}
  for (const query of ['2022','Kunal','birthday','photo']) assert.equal(matchesMemory(memory,query),true)
  assert.equal(matchesMemory(memory,'wedding'),false)
})
test('preview recognizes types with missing MIME and never embeds HTML', () => {
  assert.equal(previewKind({name:'REPORT.PDF'}),'pdf')
  assert.equal(previewKind({name:'page.html',mimeType:'text/html'}),'text')
  assert.equal(previewKind({name:'clip.mp4'}),'video')
  assert.equal(previewKind({name:'unknown.zip'}),'unsupported')
})

test('search includes note bodies and saved-link URLs and descriptions', () => {
 assert.equal(matchesMemory({name:'Server',kind:'note',content:'Remember the summer picnic'},'picnic'),true)
 assert.equal(matchesMemory({name:'Reference',kind:'link',url:'https://example.com/recipes',content:'Dinner ideas'},'recipes'),true)
 assert.equal(matchesMemory({name:'Reference',kind:'link',content:'Dinner ideas'},'dinner'),true)
})
