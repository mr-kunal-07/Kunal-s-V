import useArchive from './useArchive'
import DayBook from './DayBook'
import { contentBytes } from './storage-size'
import NoteChecklist from './NoteChecklist'
import NoteMedia from './NoteMedia'
import { uploadNoteAttachment, deleteNoteAttachment } from './memories'
import { LinkDialog, CaptureDialog } from './CaptureDialogs'
import { setTrashed } from './trash'
import { expandSelection } from './bulk-utils'
import BulkDialog from './BulkDialog'
import { VaultLoader, CollectionSkeleton } from './Loaders'
import NoteEditor from './NoteEditor'
import { PreviewDialog, MoveDialog, DetailsDialog } from './FeatureDialogs'
import { matchesMemory } from './memory-features'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth'

import { Button, TextInput, PasswordInput, InlineNotification, Modal, Search, Tag, ProgressBar } from '@carbon/react'
import { Add, ArrowRight, Folder, FolderAdd, Document, DocumentBlank, Image, Video, Music, Upload, Download, Star, StarFilled, Grid, List, Search as SearchIcon, Logout, Menu, Close, OverflowMenuVertical, TrashCan, Edit, Cloud, ChevronRight, Time, Locked, Save, Checkmark, Pin, PinFilled, Link as LinkIcon, Microphone, Camera } from '@carbon/icons-react'
import { auth, explainError, loginEmail, ownerUid } from './firebase'
import { memoriesCollection, createMemory, updateMemory, removeMemory, uploadFile, openFile, droppedFiles, fileSize } from './memories'

function Brand() { return <Link className="brand" to="/dashboard"><span className="brand-mark"><img src="/vault.svg" alt="" width="28" height="28" /></span><span>Kunal’s Vault</span></Link> }
function ErrorNotice({ message, onClose }) { return message && <InlineNotification kind="error" title="Something needs attention" subtitle={message} onCloseButtonClick={onClose} lowContrast /> }

function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [info, setInfo] = useState('')
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault(); setError(''); setInfo(''); setBusy(true)
    try { const credential = await signInWithEmailAndPassword(auth, loginEmail(email), password); if (credential.user.uid !== ownerUid) { await signOut(auth); throw new Error('This app is reserved for kunal.') } navigate('/dashboard', { replace: true }) }
    catch (err) { setError(explainError(err)) } finally { setBusy(false) }
  }
  async function reset() {
    if (!email.trim() || !email.includes('@')) { setError('Enter your account’s real email address to request a reset. Username accounts need a password reset through the administrator.'); return }
    setBusy(true); setError(''); setInfo('')
    try { await sendPasswordResetEmail(auth, email.trim()); setInfo('If this account exists, a reset link will arrive in your inbox.') }
    catch (err) { setError(explainError(err)) } finally { setBusy(false) }
  }
  return <div className="login-page">
    <header className="topbar"><Brand /><Locked size={18} /></header>
    <main className="login-main">
      <section className="login-panel"><div className="login-form-wrap"><h1 className="login-heading">Sign in</h1><form onSubmit={submit}>
        <TextInput id="email" labelText="Username" type="text" autoComplete="username" placeholder="Enter your username" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
        <PasswordInput id="password" labelText="Password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />

        <ErrorNotice message={error} onClose={() => setError('')} />
        {info && <InlineNotification kind="success" title="Check your email" subtitle={info} onCloseButtonClick={() => setInfo('')} lowContrast />}
        <Button className="login-submit" type="submit" renderIcon={ArrowRight} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form></div></section>
    </main>
  </div>
}
function ItemIcon({ item, size = 24 }) {
  const Icon = item.kind === 'folder' ? Folder : item.kind === 'link' ? LinkIcon : item.kind === 'note' ? DocumentBlank : item.mimeType?.startsWith('image/') ? Image : item.mimeType?.startsWith('video/') ? Video : item.mimeType?.startsWith('audio/') ? Music : Document
  return <Icon size={size} />
}
function MemoryVisual({ item, size, count }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    if (item.kind === 'file' && item.mimeType?.startsWith('image/')) {
      openFile(item).then(value => { if (active) setUrl(value) }).catch(() => {})
    }
    return () => { active = false }
  }, [item.id, item.kind, item.mimeType, item.storagePath])
  return <div className={`memory-visual ${url ? 'has-image' : ''}`}>
    {url ? <img src={url} alt="" loading="lazy" onError={() => setUrl('')} /> : <ItemIcon item={item} size={size} />}
    {item.kind === 'note' && <p>{item.content || 'A little thought, kept.'}</p>}
    {item.kind === 'folder' && <span>{count} items</span>}
    {item.kind === 'file' && !url && <span>{item.name.split('.').pop().slice(0, 8).toUpperCase()}</span>}
  </div>
}
const dateLabel = item => item.updatedAt?.toDate ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(item.updatedAt.toDate()) : 'Just now'

function Dashboard({ user }) {
  const { folderId } = useParams(), navigate = useNavigate(), location = useLocation()
  const {items,loading,loadingMore,hasMore,error,setError,loadMore,loadComplete} = useArchive(user.uid)
  const [operationItems,setOperationItems] = useState(null)
  const [search, setSearch] = useState(''), [filter, setFilter] = useState(location.pathname === '/day-book' ? 'daybook' : 'all'), [view, setView] = useState('list')
  useEffect(() => { if(location.pathname === '/day-book')setFilter('daybook');else setFilter(current => current === 'daybook' ? 'all' : current) },[location.pathname])
  const [mobileNav, setMobileNav] = useState(false), [modal, setModal] = useState(null)
  const [name, setName] = useState(''), [text, setText] = useState(''), [busy, setBusy] = useState(false)
  const [previewItem, setPreviewItem] = useState(null), [moveItem, setMoveItem] = useState(null), [detailsItem, setDetailsItem] = useState(null)
  const [archivePage,setArchivePage] = useState(1)
  const archivePageSize = 25
  useEffect(() => { setArchivePage(1); setSelectedIds([]) },[folderId,filter,search])
  const [selectedIds, setSelectedIds] = useState([]), [bulkAction, setBulkAction] = useState(null)
  useEffect(() => { setSelectedIds([]) }, [folderId, filter, search])
  const selectedItems = items.filter(item => selectedIds.includes(item.id))
  function toggleSelected(id) { setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]) }
  const [linkDialog, setLinkDialog] = useState(null), [captureMode, setCaptureMode] = useState(null), [mobileAdd, setMobileAdd] = useState(false)
  const [checklist,setChecklist] = useState([])
  const [noteAttachments, setNoteAttachments] = useState([]), [noteRecording, setNoteRecording] = useState(false)
  const [noteHtml, setNoteHtml] = useState('')
  const [modalError, setModalError] = useState('')
  const [uploading, setUploading] = useState(null), [toast, setToast] = useState(''), [dragging, setDragging] = useState(false), [menu, setMenu] = useState(null)
  const filesInput = useRef(null), folderInput = useRef(null), uploadLock = useRef(false), dragDepth = useRef(0)
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 5000); return () => clearTimeout(id) }, [toast])
  useEffect(() => { setSearch(''); setMenu(null) }, [folderId, filter])
  useEffect(() => { if(!hasMore || filter === 'daybook' || (!folderId && filter === 'all' && !search.trim()))return; const timer=setTimeout(()=>{loadComplete().catch(()=>{})},search.trim()?350:0);return()=>clearTimeout(timer) },[folderId,filter,search,hasMore,loadComplete])
  async function prepareArchive(action) { try { const all = hasMore ? await loadComplete() : items; setOperationItems(all); action(all) } catch(err) { setError(explainError(err)) } }
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null), key = e => { if (e.key === 'Escape') close() }
    document.addEventListener('click', close); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key) }
  }, [menu])
  const current = folderId ? items.find(i => i.id === folderId && i.kind === 'folder') : null
  const invalidFolder = folderId && !loading && !loadingMore && !hasMore && !current
  const activeItems = items.filter(i => !i.deletedAt), trashItems = items.filter(i => i.deletedAt)
  const folders = activeItems.filter(i => i.kind === 'folder'), favorites = activeItems.filter(i => i.favorite), notes = activeItems.filter(i => i.kind === 'note'), files = activeItems.filter(i => i.kind === 'file')
  const totalBytes = contentBytes(activeItems)
  const scoped = (filter === 'trash' ? trashItems : activeItems).filter(i => search.trim() ? true : folderId ? i.parentId === folderId : filter === 'all' ? !i.parentId : true)
  const visible = scoped.filter(i => (filter === 'favorites' ? i.favorite : filter === 'notes' ? i.kind === 'note' : filter === 'files' ? i.kind === 'file' : filter === 'links' ? i.kind === 'link' : true) && matchesMemory(i, search)).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (b.kind === 'folder') - (a.kind === 'folder') || (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
  const pageCount = Math.max(1,Math.ceil(visible.length/archivePageSize))
  const currentPage = Math.min(archivePage,pageCount)
  const pageItems = visible.slice((currentPage-1)*archivePageSize,currentPage*archivePageSize)
  const displayedBytes = contentBytes(expandSelection(visible, filter === 'trash' ? trashItems : activeItems))
  const title = current?.name || ({ daybook: 'Day Book', all: 'Your memories', favorites: 'Favorites', notes: 'Your notes', links: 'Saved links', files: 'All files', trash: 'Trash' }[filter])
  const crumbs = [], seen = new Set(); let ancestor = current
  while (ancestor && !seen.has(ancestor.id)) { seen.add(ancestor.id); crumbs.unshift(ancestor); ancestor = items.find(i => i.id === ancestor.parentId) }
  function selectFilter(next) { setFilter(next); navigate(next === 'daybook' ? '/day-book' : '/dashboard'); setMobileNav(false) }
  function showModal(kind, item = null) { setModalError(''); setModal({ kind, item }); setName(item?.name || ''); setText(item?.content || ''); setNoteHtml(item?.noteHtml || ''); setNoteAttachments(item?.noteAttachments || []); setChecklist(item?.checklist || []); setMenu(null) }
  async function save() {
    if (!name.trim() || noteRecording) return
    setBusy(true)
    try {
      const uploaded = []
    let attachments = noteAttachments
    if(modal.kind === 'note') {
      try { attachments = []; for(const item of noteAttachments) { const saved = item.file ? await uploadNoteAttachment(user.uid,item) : item; attachments.push(saved); if(item.file)uploaded.push(saved) } }
      catch(error) { await Promise.allSettled(uploaded.map(deleteNoteAttachment)); throw error }
    }
    const data = { name: name.trim(), ...(modal.kind === 'note' ? { content: text, noteHtml, noteAttachments: attachments, checklist } : {}) }
      try { if (modal.item) await updateMemory(user.uid, modal.item.id, data)
      else await createMemory(user.uid, { ...data, kind: modal.kind, parentId: folderId || null }) } catch(error) { await Promise.allSettled(uploaded.map(deleteNoteAttachment)); throw error }
      if(modal.kind === 'note') await Promise.allSettled((modal.item?.noteAttachments || []).filter(old => !attachments.some(item => item.id === old.id)).map(deleteNoteAttachment))
      setToast(modal.item ? 'Memory updated.' : modal.kind === 'folder' ? 'Folder created.' : 'Note saved.'); setModal(null)
    } catch (err) { setModalError(explainError(err)) } finally { setBusy(false) }
  }
  async function togglePin(item) { try { await updateMemory(user.uid, item.id, { pinned: !item.pinned }); setMenu(null) } catch (err) { setError(explainError(err)) } }
  async function favorite(item) { try { await updateMemory(user.uid, item.id, { favorite: !item.favorite }) } catch (err) { setError(explainError(err)) } }
  async function download(item) {
    const tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null
    try { const url = await openFile(item); if (tab) tab.location.replace(url); else setError('Allow pop-ups to open this file.') }
    catch (err) { tab?.close(); setError(explainError(err)) }
  }
  function open(item) { if (item.kind === 'folder') { setFilter(item.deletedAt ? 'trash' : 'all'); navigate(`/dashboard/${item.id}`) } else if (item.kind === 'link') setLinkDialog({item}); else if (item.kind === 'note') showModal('note', item); else setPreviewItem(item) }
  async function restore(item) {
    try { await setTrashed(user.uid, [item], hasMore ? await loadComplete() : items, false); setToast('Memory restored.'); setMenu(null) }
    catch(err) { setError(explainError(err)) }
  }
  async function deleteItem() {
    setBusy(true)
    try {
      if(filter === 'trash') {
        const targets = expandSelection([modal.item], operationItems || items)
        if(targets.some(i => !i.deletedAt)) throw new Error('Restore this folder before managing its active contents.')
        // Repeated leaf removal keeps folders until their contents have been removed.
        const remaining = [...targets]
        while(remaining.length) {
          const index = remaining.findIndex(i => !remaining.some(child => child.parentId === i.id))
          if(index < 0) throw new Error('Invalid folder structure.')
          await removeMemory(user.uid, remaining[index]); remaining.splice(index,1)
        }
        setToast('Permanently deleted.')
      } else { await setTrashed(user.uid, [modal.item], operationItems || items, true); setToast('Moved to Trash.') }
      setModal(null)
    } catch(err) { setModalError(explainError(err)) } finally { setBusy(false) }
  }
  async function upload(entries) {
    if (!entries.length || uploadLock.current || invalidFolder) return
    uploadLock.current = true; setError(''); let completed = 0
    const folderMap = new Map([['', folderId || null]])
    async function ensureFolder(path) {
      if (folderMap.has(path)) return folderMap.get(path)
      const segments = path.split('/'), name = segments.pop(), parentId = await ensureFolder(segments.join('/'))
      const id = await createMemory(user.uid, { name, parentId, kind: 'folder' }); folderMap.set(path, id); return id
    }
    try {
      for (const entry of entries) {
        setUploading({ name: entry.directory || entry.file.name, progress: 0, index: completed + 1, total: entries.length })
        if (entry.directory) await ensureFolder(entry.directory)
        else { const path = entry.path.split('/').slice(0, -1).join('/'), parentId = await ensureFolder(path); await uploadFile(user.uid, entry.file, parentId, progress => setUploading(prev => ({ ...prev, progress }))) }
        completed++
      }
      setToast(`${completed} ${completed === 1 ? 'item' : 'items'} added to your memories.`)
    } catch (err) { setError(`${completed ? `${completed} items saved. ` : ''}${explainError(err)} Remaining items were not uploaded.`) }
    finally { setUploading(null); uploadLock.current = false; filesInput.current.value = ''; folderInput.current.value = '' }
  }
  async function drop(event) {
    event.preventDefault(); dragDepth.current = 0; setDragging(false); if (uploadLock.current) return
    try { await upload(await droppedFiles(event.dataTransfer)) } catch (err) { setError(explainError(err)) }
  }
  const hasFiles = e => Array.from(e.dataTransfer.types).includes('Files')
  return <div className="app-shell">
    <header className="topbar"><button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <Close size={20} /> : <Menu size={20} />}</button><Brand /><div className="header-account"><span className="account-avatar">{user.email?.[0]?.toUpperCase() || 'K'}</span><span className="account-email">{user.email?.endsWith("@task-d72fd.firebaseapp.com") ? user.email.split("@")[0] : user.email}</span><button className="icon-button" aria-label="Sign out" onClick={() => signOut(auth).catch(err => setError(explainError(err)))}><Logout size={20} /></button></div></header>
    {mobileNav && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}><div className="sidebar-label">PERSONAL SPACE</div><nav aria-label="Main navigation">{[['daybook', DocumentBlank, 'Day Book', ''], ['all', Grid, 'All memories', activeItems.length], ['favorites', Star, 'Favorites', favorites.length], ['notes', DocumentBlank, 'Notes', notes.length], ['links', LinkIcon, 'Saved links', activeItems.filter(i => i.kind === 'link').length], ['files', Document, 'Files', files.length], ['trash', TrashCan, 'Trash', trashItems.length]].map(([key, Icon, label, count]) => <button key={key} className={`nav-item ${filter === key && !folderId ? 'active' : ''}`} onClick={() => selectFilter(key)}><Icon size={20} /><span>{label}</span><span className="nav-count">{hasMore && count !== '' ? count + '+' : count}</span></button>)}</nav><div className="sidebar-divider" /><div className="sidebar-label folders-label">FOLDERS <button className="icon-button" aria-label="Create folder" onClick={() => { showModal('folder'); setMobileNav(false) }}><Add size={18} /></button></div><div className="sidebar-folders">{folders.filter(i => !i.parentId).map(item => <button key={item.id} className={`nav-item ${folderId === item.id ? 'active' : ''}`} onClick={() => { open(item); setMobileNav(false) }}><Folder size={20} /><span>{item.name}</span></button>)}{!folders.length && <p className="sidebar-hint">No folders yet.</p>}</div><div className="storage-panel"><div><Cloud size={20} /><span>Your archive</span><span className="storage-size">{hasMore ? <button className="load-totals-button" onClick={()=>loadComplete().catch(()=>{})} disabled={loadingMore}>Load totals</button> : fileSize(totalBytes)}</span></div><p>{files.length}{hasMore ? '+' : ''} files {hasMore ? 'loaded' : 'collected'}</p></div></aside>
    <main className="dashboard" onDragEnter={e => { if (hasFiles(e)) { e.preventDefault(); dragDepth.current++; setDragging(true) } }} onDragOver={e => { if (hasFiles(e)) e.preventDefault() }} onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) setDragging(false) }} onDrop={drop}>
      <div className="dashboard-inner">{filter === 'daybook' ? <DayBook uid={user.uid} /> : <><div className="dashboard-topbar"><div className="breadcrumb"><button onClick={() => selectFilter('all')}>My space</button>{(crumbs.length > 0 || filter !== 'all') && <ChevronRight size={14} />}{crumbs.length ? crumbs.map((item, i) => <span key={item.id}><button onClick={() => navigate(`/dashboard/${item.id}`)}>{item.name}</button>{i < crumbs.length - 1 && <ChevronRight size={14} />}</span>) : filter !== 'all' ? <span>{title}</span> : null}</div>
      <div className="page-heading"><div className="heading-actions"><Button className="heading-folder-button" aria-label="New folder" title="New folder" kind="tertiary" renderIcon={FolderAdd} onClick={() => showModal('folder')} disabled={filter === 'trash' || invalidFolder || !!uploading}><span className="heading-action-text">New folder</span></Button><Button className="heading-upload-button" aria-label="Upload files" title="Upload files" renderIcon={Upload} onClick={() => filesInput.current.click()} disabled={filter === 'trash' || invalidFolder || !!uploading}><span className="heading-action-text">Upload</span></Button></div></div></div>
      <ErrorNotice message={error} onClose={() => setError('')} />
      {toast && <div className="vault-toast" role="status" aria-live="polite"><Checkmark size={16} aria-hidden="true"/><span>{toast.replace(' selected items ', ' items ')}</span><button type="button" aria-label="Dismiss message" onClick={() => setToast('')}><Close size={16}/></button></div>}
      <div className="section-heading"><h2>{search ? 'Search results' : folderId ? 'In this folder' : filter === 'all' ? 'Your collection' : title} <span>{visible.length}</span></h2><span className="sort-label"><Pin size={14} /><span className="sort-desktop">{hasMore ? 'Loaded items · Recently updated' : 'Pinned first · Recently updated'}</span><span className="sort-mobile">Recent</span></span></div>
      <div className="collection-toolbar"><Search id="memory-search" size="lg" labelText="Search memories" placeholder="Search names, notes, tags, or year…" value={search} onChange={e => setSearch(e.target.value)} closeButtonLabelText="Clear search" /><div className="toolbar-actions"><div className="mobile-add-wrap"><button className="mobile-add-toggle" aria-expanded={mobileAdd} aria-controls="mobile-add-menu" onClick={() => setMobileAdd(!mobileAdd)} disabled={filter === 'trash'}><Add size={16}/>Add</button>{mobileAdd && <><button className="mobile-add-dismiss" aria-label="Close add menu" onClick={() => setMobileAdd(false)}/><div className="mobile-add-menu" id="mobile-add-menu"><button onClick={() => { setLinkDialog({}); setMobileAdd(false) }}><LinkIcon size={16}/>Save link</button><button onClick={() => { setCaptureMode('audio'); setMobileAdd(false) }}><Microphone size={16}/>Record voice</button><button onClick={() => { setCaptureMode('scan'); setMobileAdd(false) }}><Camera size={16}/>Scan document</button><button disabled={!!uploading || invalidFolder} onClick={() => { folderInput.current.click(); setMobileAdd(false) }}><FolderAdd size={16}/>Upload folder</button></div></>}</div><button className="icon-button" title="Save link" aria-label="Save link" disabled={filter === 'trash'} onClick={() => setLinkDialog({})}><LinkIcon size={18}/></button><button className="icon-button" title="Record voice memory" aria-label="Record voice memory" disabled={filter === 'trash'} onClick={() => setCaptureMode('audio')}><Microphone size={18}/></button><button className="icon-button" title="Scan document" aria-label="Scan document" disabled={filter === 'trash'} onClick={() => setCaptureMode('scan')}><Camera size={18}/></button><button className="toolbar-note" onClick={() => showModal('note')} disabled={filter === 'trash' || invalidFolder}><Edit size={18} /><span>New note</span></button><button className="icon-button upload-folder" aria-label="Upload a folder" title="Upload a folder" disabled={!!uploading || invalidFolder} onClick={() => folderInput.current.click()}><FolderAdd size={20} /></button><div className="view-switch" aria-label="Collection view"><button className={`icon-button ${view === 'grid' ? 'selected' : ''}`} aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid size={20} /></button><button className={`icon-button ${view === 'list' ? 'selected' : ''}`} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={20} /></button></div></div></div>
      {!loading && visible.length > 0 && selectedItems.length > 0 && <div className="bulk-toolbar" aria-label="Selected item actions"><div className="bulk-selection"><label><input type="checkbox" aria-label="Select all items on this page" checked={pageItems.every(item => selectedIds.includes(item.id))} ref={node => { if(node) node.indeterminate = selectedItems.length > 0 && !pageItems.every(item => selectedIds.includes(item.id)) }} onChange={e => setSelectedIds(e.target.checked ? pageItems.map(item => item.id) : [])} /><span>Select page</span></label><span className="bulk-count">{selectedItems.length} selected</span></div><div className="bulk-actions">{filter === 'trash' ? <button onClick={() => prepareArchive(() => setBulkAction('restore'))}><ArrowRight size={16} />Restore</button> : <><button onClick={() => prepareArchive(() => setBulkAction('move'))}><Folder size={16} />Move</button><button onClick={() => prepareArchive(() => setBulkAction('tag'))}><Edit size={16} />Tag</button></>}<button onClick={() => prepareArchive(() => setBulkAction('download'))}><Download size={16} />Download</button><button className="bulk-delete" onClick={() => prepareArchive(() => setBulkAction(filter === 'trash' ? 'purge' : 'delete'))}><TrashCan size={16} />{filter === 'trash' ? 'Delete forever' : 'Trash'}</button><button className="bulk-clear" title="Clear selection" aria-label="Clear selection" onClick={() => setSelectedIds([])}><Close size={16} /></button></div></div>}
      {uploading && <div className="upload-progress"><ProgressBar label={`Saving ${uploading.index} of ${uploading.total}: ${uploading.name}`} value={Math.round(uploading.progress * 100)} helperText="Keep this page open until your upload finishes." /></div>}
      {loading && items.length === 0 ? <CollectionSkeleton view={view} /> : invalidFolder ? <div className="empty-state"><Folder size={48} /><h3>This folder isn’t here.</h3><p>It may have been deleted.</p><Button kind="tertiary" onClick={() => selectFilter('all')}>Back to my space</Button></div> : visible.length === 0 ? <div className="empty-state"><div className="empty-icon">{search ? <SearchIcon size={36} /> : filter === 'favorites' ? <Star size={36} /> : <Folder size={40} />}</div><h3>{search ? 'No memories found.' : hasMore ? 'More items are available.' : filter === 'trash' ? 'Trash is empty.' : filter === 'favorites' ? 'No favorites yet.' : 'No memories yet.'}</h3><p>{search ? 'Try another name or a different search.' : filter === 'favorites' ? 'Tap the star on a memory to find it here.' : hasMore ? 'Load more to see the rest of your archive.' : 'Upload files or create a note.'}</p>{!search && filter !== 'favorites' && filter !== 'trash' && <div className="empty-actions"><Button renderIcon={Upload} onClick={() => filesInput.current.click()} disabled={!!uploading}>Upload files</Button><Button kind="ghost" renderIcon={Edit} onClick={() => showModal('note')}>Write a note</Button></div>}<span className="drop-hint">Drop files or folders · Max 100 MB per file</span></div> : <div className={`memory-collection ${view}`}>
        {pageItems.map(item => <article key={item.id} style={item.kind === 'folder' && item.folderColor ? {'--folder-color': item.folderColor} : undefined} className={`memory-card kind-${item.kind} ${selectedIds.includes(item.id) ? 'is-selected' : ''}`}><label className="memory-select"><input type="checkbox" aria-label={`Select ${item.name}`} checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /></label><button className="memory-open" onClick={() => open(item)}><MemoryVisual item={item} size={view === 'grid' ? 34 : 24} count={items.filter(i => i.parentId === item.id).length} /><div className="memory-info"><h3>{item.pinned && <PinFilled className="memory-pin" size={14} aria-label="Pinned" />}{item.name}</h3><div className="memory-metadata">{item.memoryDate && <time dateTime={item.memoryDate}>{item.memoryDate}</time>}{(item.tags || []).slice(0, 3).map(tag => <span key={tag} className="memory-tag">#{tag}</span>)}{item.tags?.length > 3 && <span>+{item.tags.length - 3}</span>}</div><p>{item.kind === 'folder' ? 'Folder' + (hasMore ? '' : ' · ' + fileSize(contentBytes(expandSelection([item], filter === 'trash' ? trashItems : activeItems)))) : item.kind === 'note' ? 'Note · ' + fileSize(contentBytes([item])) : item.kind === 'link' ? 'Link' : fileSize(item.size || 0)}<span>·</span>{dateLabel(item)}</p></div></button><div className="memory-controls"><button className={`icon-button favorite-button ${item.favorite ? 'is-favorite' : ''}`} aria-label={`${item.favorite ? 'Unfavorite' : 'Favorite'} ${item.name}`} onClick={() => favorite(item)}>{item.favorite ? <StarFilled size={18} /> : <Star size={18} />}</button><div className="item-menu-wrap"><button className="icon-button" aria-label={`Actions for ${item.name}`} aria-expanded={menu === item.id} onClick={e => { e.stopPropagation(); setMenu(menu === item.id ? null : item.id) }}><OverflowMenuVertical size={18} /></button>{menu === item.id && <div className="item-menu">{filter !== 'trash' && <button onClick={() => togglePin(item)}><Pin size={16} />{item.pinned ? 'Unpin' : 'Pin to top'}</button>}{filter === 'trash' && <button onClick={() => restore(item)}>Restore</button>}<button disabled={filter === 'trash'} onClick={() => { setDetailsItem(item); setMenu(null) }}><Time size={16} />Date &amp; tags</button><button disabled={filter === 'trash'} onClick={() => prepareArchive(() => { setMoveItem(item); setMenu(null) })}><Folder size={16} />Move to folder</button><button disabled={filter === 'trash'} onClick={() => item.kind === 'link' ? setLinkDialog({item}) : showModal(item.kind === 'note' ? 'note' : 'rename', item)}><Edit size={16} />{item.kind === 'link' ? 'Edit link' : item.kind === 'note' ? 'Edit note' : 'Rename'}</button>{item.kind === 'file' && <button onClick={() => download(item)}><Download size={16} />Open / download</button>}<button className="danger-action" onClick={() => prepareArchive(() => showModal('delete', item))}><TrashCan size={16} />Delete</button></div>}</div></div></article>)}
      </div>}
      {pageCount>1&&<nav className="archive-pagination" aria-label="Archive pages"><span>{(currentPage-1)*archivePageSize+1}–{Math.min(currentPage*archivePageSize,visible.length)} of {visible.length}</span><button disabled={currentPage===1} onClick={()=>{setArchivePage(currentPage-1);setSelectedIds([])}}>Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage===pageCount} onClick={()=>{setArchivePage(currentPage+1);setSelectedIds([])}}>Next</button></nav>}
      {(hasMore||loadingMore)&&<div className="archive-load-more" role="status"><span>{loadingMore?'Loading archive…':`${items.length} items loaded · more available`}</span><Button kind="tertiary" disabled={loadingMore} onClick={loadMore}>Load 25 more</Button><Button kind="ghost" disabled={loadingMore} onClick={()=>loadComplete().catch(()=>{})}>Load all & totals</Button></div>}
      <div className="collection-footer"><span title="Content size: files, attachments, and estimated note/link data. Includes subfolders; excludes Firebase indexes and system metadata.">{visible.length}{hasMore ? '+' : ''} {visible.length === 1 ? 'item' : 'items'} · {hasMore ? 'Load all for total size' : fileSize(displayedBytes)}</span></div></>}</div>
      {dragging && <div className="drop-overlay"><Upload size={48} /><h2>A good place to drop your memories.</h2><p>Files and folders welcome.</p></div>}
    </main>
    <input ref={filesInput} className="visually-hidden" type="file" multiple onChange={e => upload(Array.from(e.target.files).map(file => ({ file, path: file.name })))} aria-label="Choose files" />
    <input ref={folderInput} className="visually-hidden" type="file" multiple webkitdirectory="" directory="" onChange={e => upload(Array.from(e.target.files).map(file => ({ file, path: file.webkitRelativePath || file.name })))} aria-label="Choose folder" />
    {linkDialog && <LinkDialog uid={user.uid} parentId={folderId || null} item={linkDialog.item} onClose={() => setLinkDialog(null)} onSaved={setToast} />}{captureMode && <CaptureDialog mode={captureMode} uid={user.uid} parentId={folderId || null} onClose={() => setCaptureMode(null)} onSaved={setToast} />}
    {bulkAction && <BulkDialog action={bulkAction} selected={selectedItems} items={operationItems || items} uid={user.uid} onClose={() => setBulkAction(null)} onDone={(ids, message) => { setSelectedIds(current => current.filter(id => !ids.includes(id))); setToast(message) }} />}
    {previewItem && <PreviewDialog item={previewItem} images={visible.filter(i => i.kind === 'file' && (i.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(i.name)))} onNavigate={setPreviewItem} onClose={() => setPreviewItem(null)} />}{moveItem && <MoveDialog item={moveItem} items={operationItems || items} uid={user.uid} onClose={() => setMoveItem(null)} onSaved={setToast} />}{detailsItem && <DetailsDialog item={detailsItem} uid={user.uid} onClose={() => setDetailsItem(null)} onSaved={setToast} />}
    <Modal className={modal?.kind === 'note' ? 'vault-note-modal' : undefined} open={!!modal} modalHeading={modal?.kind === 'delete' ? (filter === 'trash' ? 'Permanently delete?' : 'Move to Trash?') : modal?.kind === 'rename' ? 'Rename memory' : modal?.kind === 'folder' ? 'New folder' : (modal?.item ? 'Edit note' : 'New note')} modalLabel={modal?.kind === 'delete' ? (filter === 'trash' ? 'THIS CANNOT BE UNDONE' : 'RECOVERABLE FROM TRASH') : modal?.kind === 'folder' ? 'NEW FOLDER' : 'YOUR PERSONAL ARCHIVE'} primaryButtonText={<span className="modal-action-label">{busy ? 'Saving…' : modal?.kind === 'delete' ? (filter === 'trash' ? 'Delete forever' : 'Move to Trash') : modal?.kind === 'folder' ? 'Create folder' : 'Save memory'}{modal?.kind === 'delete' ? <TrashCan size={16} /> : <Save size={16} />}</span>} secondaryButtonText={<span className="modal-action-label">Cancel<Close size={16} /></span>} danger={modal?.kind === 'delete'} primaryButtonDisabled={busy || noteRecording || (modal?.kind !== 'delete' && !name.trim())} onRequestClose={() => { if (!busy) setModal(null) }} onRequestSubmit={modal?.kind === 'delete' ? deleteItem : save} preventCloseOnClickOutside>
      <ErrorNotice message={modalError} onClose={() => setModalError('')} />
      {modal?.kind === 'delete' ? <p>“{modal.item.name}” {filter === 'trash' ? 'and its contents will be permanently deleted. This cannot be undone.' : 'and its contents will move to Trash. You can restore them later.'}</p> : <><TextInput id="memory-name" labelText={modal?.kind === 'folder' ? 'Folder name' : 'Title'} placeholder={modal?.kind === 'folder' ? 'A summer to remember' : 'Give this memory a name'} maxLength={160} value={name} onChange={e => setName(e.target.value)} disabled={busy} />{modal?.kind === 'note' && <><NoteEditor key={modal?.item?.id || 'new'} content={text} html={noteHtml} onChange={(plain, html) => { setText(plain); setNoteHtml(html) }} disabled={busy} /><NoteChecklist items={checklist} onChange={setChecklist} disabled={busy} /><NoteMedia items={noteAttachments} onChange={setNoteAttachments} disabled={busy} onRecordingChange={setNoteRecording} /></>}</>}
    </Modal>
  </div>
}
export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false)
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current?.uid === ownerUid ? current : null); if (current && current.uid !== ownerUid) signOut(auth).catch(() => {}); setReady(true) }), [])
  if (!ready) return <VaultLoader />
  return <BrowserRouter><Routes><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} /><Route path="/day-book" element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} /><Route path="/dashboard/:folderId?" element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />} /><Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} /></Routes></BrowserRouter>
}











































