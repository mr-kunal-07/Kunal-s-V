export function canMoveTo(item, destinationId, items) {
  if (!item || destinationId === item.id) return false
  const seen = new Set()
  let id = destinationId
  while (id) {
    if (id === item.id || seen.has(id)) return false
    seen.add(id)
    const folder = items.find(entry => entry.id === id && entry.kind === 'folder')
    if (!folder) return false
    id = folder.parentId
  }
  return true
}
export function parseTags(value) {
  const tags = [...new Set(value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))]
  if (tags.length > 20 || tags.some(tag => tag.length > 50)) throw new Error('Use up to 20 tags, each no longer than 50 characters.')
  return tags
}
export function matchesMemory(item, search) {
  return [item.name, item.kind === 'note' || item.kind === 'link' ? item.content || '' : '', item.url || '', ...(item.checklist || []).map(row => row.text), item.memoryDate || '', ...(item.tags || [])].join(' ').toLowerCase().includes(search.trim().toLowerCase())
}
export function previewKind(item) {
  const mime = item.mimeType || '', ext = item.name.split('.').pop().toLowerCase()
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','avif','bmp'].includes(ext)) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('video/') || ['mp4','webm','mov'].includes(ext)) return 'video'
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a'].includes(ext)) return 'audio'
  if (mime.startsWith('text/') || ['txt','md','json','csv','log','xml','yaml','yml','js','jsx','ts','tsx','css','html'].includes(ext)) return 'text'
  return 'unsupported'
}


