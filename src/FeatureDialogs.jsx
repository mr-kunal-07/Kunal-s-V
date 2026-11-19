import { PreviewSkeleton } from './Loaders'
import { useEffect, useState, useRef } from 'react'
import { folderAccess, requireFolderAccess } from './folder-lock'
import { expandSelection } from './bulk-utils'
import { Modal, InlineNotification, Button, TextInput, Select, SelectItem } from '@carbon/react'
import { Download } from '@carbon/icons-react'
import { openFile, updateMemory } from './memories'
import { explainError } from './firebase'
import { canMoveTo, parseTags, previewKind } from './memory-features'

function Failure({ message }) { return message && <InlineNotification kind="error" title="Unable to complete" subtitle={message} hideCloseButton lowContrast /> }
export function PreviewDialog({ item, images = [], onNavigate, onClose }) {
  const [url, setUrl] = useState(''), [text, setText] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const kind = previewKind(item)
  const touchStart = useRef(null)
  const index = images.findIndex(image => image.id === item.id)
  const navigate = direction => { if(images.length > 1 && onNavigate) onNavigate(images[(index + direction + images.length) % images.length]) }
  useEffect(() => {
    if(kind !== 'image' || images.length < 2) return
    const key = event => { if(event.target?.matches('input,textarea,select,[contenteditable="true"]'))return; if(event.key === 'ArrowLeft'){event.preventDefault();navigate(-1)} if(event.key === 'ArrowRight'){event.preventDefault();navigate(1)} }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown',key)
  }, [item.id, images, kind])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    setLoading(true); setError(''); setUrl(''); setText('')
    async function load() {
      try {
        if (kind === 'text' && item.size > 1024 * 1024) throw new Error('Text preview supports files up to 1 MB. Download this file to read it.')
        const value = await openFile(item)
        if (!active) return
        setUrl(value)
        if (kind === 'text') {
          const response = await fetch(value, { signal: controller.signal })
          if (!response.ok) throw new Error('Could not load this text file.')
          const content = await response.text()
          if (active) setText(content.slice(0, 1024 * 1024))
        }
      } catch (err) { if (active) setError(explainError(err)) }
      finally { if (active) setLoading(false) }
    }
    load(); return () => { active = false; controller.abort() }
  }, [item.id, item.storagePath, item.size, kind])
  return <Modal open passiveModal size="lg" modalHeading={item.name} modalLabel="PREVIEW" onRequestClose={onClose}>
    <div className="file-preview" onTouchStart={e => { touchStart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null }} onTouchEnd={e => { if(!touchStart.current || kind !== 'image')return; const dx=e.changedTouches[0].clientX-touchStart.current.x,dy=e.changedTouches[0].clientY-touchStart.current.y; touchStart.current=null;if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5)navigate(dx<0?1:-1) }}><Failure message={error} />{loading ? <PreviewSkeleton /> : !error && <>
      {kind === 'image' && <img src={url} alt={item.name} onError={() => setError('This image could not be displayed. Download it to view the original.')} />}
      {kind === 'pdf' && <iframe src={url} title={`PDF preview: ${item.name}`} />}
      {kind === 'video' && <video src={url} controls playsInline preload="metadata" onError={() => setError('Your browser cannot play this video format. Download the original to watch it.')} />}
      {kind === 'audio' && <audio src={url} controls preload="metadata" onError={() => setError('Your browser cannot play this audio format.')} />}
      {kind === 'text' && <pre>{text || '(Empty file)'}</pre>}
      {kind === 'unsupported' && <p>No preview for this file type. Download it to open it in another app.</p>}
    </>}</div>
    {kind === 'image' && images.length > 1 && <div className="gallery-navigation"><Button kind="tertiary" onClick={() => navigate(-1)} aria-label="Previous photo">← Previous</Button><span role="status">{index + 1} / {images.length}</span><Button kind="tertiary" onClick={() => navigate(1)} aria-label="Next photo">Next →</Button></div>}
    {url && <Button as="a" href={url} target="_blank" rel="noopener noreferrer" kind="tertiary" renderIcon={Download}>Open / download original</Button>}
  </Modal>
}
export function MoveDialog({ item, items, uid, unlockedFolders, onClose, onSaved }) {
  const [destination, setDestination] = useState(item.parentId || ''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const candidates = items.filter(folder => folder.kind === 'folder' && !folder.deletedAt && folderAccess(folder, items, unlockedFolders).allowed && canMoveTo(item, folder.id, items))
  function path(folder) {
    const parts = [folder.name], seen = new Set([folder.id]); let id = folder.parentId
    while (id && !seen.has(id)) { seen.add(id); const parent = items.find(i => i.id === id); if (!parent) break; parts.unshift(parent.name); id = parent.parentId }
    return parts.join(' / ')
  }
  async function save() {
    const current = items.find(i => i.id === item.id)
    if (!current || !canMoveTo(current, destination || null, items)) { setError('This destination is no longer available.'); return }
    setBusy(true); setError('')
    try { requireFolderAccess(expandSelection([current], items), items, unlockedFolders); if (destination) requireFolderAccess([items.find(folder => folder.id === destination)], items, unlockedFolders); await updateMemory(uid, item.id, { parentId: destination || null }); onSaved('Memory moved.'); onClose() }
    catch (err) { setError(explainError(err)) } finally { setBusy(false) }
  }
  return <Modal open modalHeading={`Move “${item.name}”`} modalLabel="ORGANIZE" primaryButtonText={busy ? 'Moving…' : 'Move here'} secondaryButtonText="Cancel" primaryButtonDisabled={busy || destination === (item.parentId || '')} onRequestSubmit={save} onRequestClose={() => { if (!busy) onClose() }} preventCloseOnClickOutside>
    <Failure message={error} /><Select id="move-destination" labelText="Destination folder" value={destination} onChange={e => setDestination(e.target.value)} disabled={busy}><SelectItem value="" text="My space (root)" />{candidates.sort((a,b) => path(a).localeCompare(path(b))).map(folder => <SelectItem key={folder.id} value={folder.id} text={path(folder)} />)}</Select><p className="dialog-help">Moving a folder includes its contents.</p>
  </Modal>
}
export function DetailsDialog({ item, uid, onClose, onSaved }) {
  const [color, setColor] = useState(item.folderColor || '#526146')
  const [date, setDate] = useState(item.memoryDate || ''), [tags, setTags] = useState((item.tags || []).join(', ')), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save() {
    setError(''); setBusy(true)
    try {
      const values = parseTags(tags)
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid memory date.')
      await updateMemory(uid, item.id, { memoryDate: date, tags: values, ...(item.kind === 'folder' ? { folderColor: color } : {}) }); onSaved('Memory details saved.'); onClose()
    } catch (err) { setError(explainError(err)) } finally { setBusy(false) }
  }
  return <Modal open modalHeading={item.name} modalLabel="MEMORY DETAILS" primaryButtonText={busy ? 'Saving…' : 'Save details'} secondaryButtonText="Cancel" primaryButtonDisabled={busy} onRequestSubmit={save} onRequestClose={() => { if (!busy) onClose() }} preventCloseOnClickOutside>
    <Failure message={error} />{item.kind === 'folder' && <div className="folder-color-options" role="group" aria-label="Folder color">{['#526146','#a8442e','#416879','#7955a0','#ac7a23','#735b4a'].map(value => <button key={value} aria-label={`Folder color ${value}`} aria-pressed={color === value} onClick={() => setColor(value)} style={{background:value}} disabled={busy}>{color === value ? '✓' : ''}</button>)}</div>}<TextInput id="memory-date" type="date" labelText="Memory date" value={date} onChange={e => setDate(e.target.value)} disabled={busy} /><TextInput id="memory-tags" labelText="Tags" helperText="Separate tags with commas. Up to 20 tags." placeholder="birthday, family, summer" value={tags} onChange={e => setTags(e.target.value)} disabled={busy} maxLength={1100} /><p className="dialog-help">Search by a tag, person, occasion, or year to find this memory.</p>
  </Modal>
}



