async function readEntry(entry, prefix = '') {
  const path = prefix + entry.name
  if (entry.isFile) return [{ file: await new Promise((resolve, reject) => entry.file(resolve, reject)), path }]
  const reader = entry.createReader()
  const result = [{ directory: path }]
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (const child of batch) result.push(...await readEntry(child, path + '/'))
  }
  return result
}
export async function droppedFiles(dataTransfer) {
  const entries = Array.from(dataTransfer.items || []).map(item => item.webkitGetAsEntry?.()).filter(Boolean)
  if (entries.length) return (await Promise.all(entries.map(entry => readEntry(entry)))).flat()
  return Array.from(dataTransfer.files).map(file => ({ file, path: file.name }))
}
export const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`

