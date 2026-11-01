const encoder = new TextEncoder()
export function contentBytes(items) {
  let total = 0
  const paths = new Set()
  for (const item of items) {
    if (item.kind === 'file' && (!item.storagePath || !paths.has(item.storagePath))) {
      total += Math.max(0, Number(item.size) || 0)
      if (item.storagePath) paths.add(item.storagePath)
    }
    if (item.kind === 'note' || item.kind === 'link') {
      total += encoder.encode(JSON.stringify({content:item.content || '',noteHtml:item.noteHtml || '',url:item.url || '',checklist:item.checklist || []})).byteLength
    }
    for (const attachment of item.noteAttachments || []) {
      if (!attachment.storagePath || !paths.has(attachment.storagePath)) {
        total += Math.max(0, Number(attachment.size) || 0)
        if (attachment.storagePath) paths.add(attachment.storagePath)
      }
    }
  }
  return total
}
