// ZIP 'store' format: no compression, so media is not recompressed.
const encoder = new TextEncoder()
function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) } return (crc ^ -1) >>> 0 }
export function makeZip(files) {
  const chunks = [], directory = []; let offset = 0, directorySize = 0
  for (const file of files) {
    const name = encoder.encode(file.name), bytes = file.bytes, crc = crc32(bytes)
    const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer)
    l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(6,0x800,true); l.setUint32(14,crc,true); l.setUint32(18,bytes.length,true); l.setUint32(22,bytes.length,true); l.setUint16(26,name.length,true); local.set(name,30)
    chunks.push(local,bytes)
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer)
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x800,true); c.setUint32(16,crc,true); c.setUint32(20,bytes.length,true); c.setUint32(24,bytes.length,true); c.setUint16(28,name.length,true); c.setUint32(42,offset,true); central.set(name,46)
    directory.push(central); directorySize += central.length; offset += local.length + bytes.length
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer)
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,directorySize,true); e.setUint32(16,offset,true)
  return new Blob([...chunks,...directory,end], {type:'application/zip'})
}
export function expandSelection(selected, items) {
  const ids = new Set(selected.map(item => item.id)); let previous = -1
  while (previous !== ids.size) { previous = ids.size; for (const item of items) if (ids.has(item.parentId)) ids.add(item.id) }
  return items.filter(item => ids.has(item.id))
}
export function selectionRoots(selected, items) {
  const ids = new Set(selected.map(item => item.id))
  return selected.filter(item => { const seen = new Set(); let id = item.parentId; while(id && !seen.has(id)) { if(ids.has(id)) return false; seen.add(id); id=items.find(i=>i.id===id)?.parentId } return true })
}
