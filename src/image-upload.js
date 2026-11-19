export const MAX_IMAGE_BYTES = 100 * 1024 * 1024

export function validateOriginalImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image of 100 MB or smaller. Images are uploaded at their original size.')
}

// Renaming wraps the original bytes; do not decode, resize, or re-encode the image.
export function originalImageFile(image, title) {
  validateOriginalImage(image)
  const originalName = image.name || 'image'
  const extension = originalName.match(/\.[a-z0-9]+$/i)?.[0] || ''
  const base = title?.trim().replace(/[\\/]/g, '_') || originalName
  const name = extension && !base.toLowerCase().endsWith(extension.toLowerCase()) ? base + extension : base
  if (name === image.name) return image
  return new File([image], name, { type: image.type, lastModified: image.lastModified ?? Date.now() })
}
