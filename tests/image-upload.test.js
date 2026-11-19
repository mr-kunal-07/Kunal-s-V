import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { MAX_IMAGE_BYTES, originalImageFile, validateOriginalImage } from '../src/image-upload.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=', 'base64')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

test('document capture preserves original PNG bytes, dimensions, MIME type and modified date when renamed', async () => {
  const source = new File([png], 'camera-original.png', { type: 'image/png', lastModified: 1700000000000 })
  const saved = originalImageFile(source, 'My document')
  const output = Buffer.from(await saved.arrayBuffer())
  assert.equal(saved.name, 'My document.png')
  assert.equal(saved.type, source.type)
  assert.equal(saved.lastModified, source.lastModified)
  assert.equal(saved.size, source.size)
  assert.equal(digest(output), digest(png))
  assert.equal(output.readUInt32BE(16), png.readUInt32BE(16))
  assert.equal(output.readUInt32BE(20), png.readUInt32BE(20))
})

test('images remain opaque original files so metadata, animation and formats requiring no browser decoder survive', async () => {
  const original = Buffer.concat([Buffer.from('Exif\0\0Original camera metadata\0'), Uint8Array.from({ length: 256 }, (_, index) => index)])
  for (const [extension, type] of [['jpg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['heic', 'image/heic'], ['dng', 'image/x-adobe-dng']]) {
    const source = new File([original], `photo.${extension}`, { type })
    const saved = originalImageFile(source, 'Full quality')
    assert.equal(saved.name, `Full quality.${extension}`)
    assert.equal(saved.type, type)
    assert.equal(saved.size, original.byteLength)
    assert.equal(digest(Buffer.from(await saved.arrayBuffer())), digest(original))
  }
})

test('an unchanged filename retains the original File and renaming keeps its original extension', () => {
  const source = new File([png], 'Photo.PNG', { type: 'image/png' })
  assert.equal(originalImageFile(source), source)
  assert.equal(originalImageFile(source, 'Photo.PNG'), source)
  assert.equal(originalImageFile(source, 'Scan.png').name, 'Scan.png')
  assert.equal(originalImageFile(source, 'Folder/Scan').name, 'Folder_Scan.PNG')
})

test('full-size images above the former capture/attachment limits are allowed up to 100 MB without shrinking', () => {
  for (const size of [20 * 1024 * 1024 + 1, 30 * 1024 * 1024 + 1, MAX_IMAGE_BYTES]) {
    assert.doesNotThrow(() => validateOriginalImage({ type: 'image/jpeg', size }))
  }
  assert.throws(() => validateOriginalImage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }), /100 MB/)
  assert.throws(() => validateOriginalImage({ type: 'text/plain', size: 10 }), /Choose an image/)
})
