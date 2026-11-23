import { useRef, useState } from 'react'
import { Add, Calendar, Checkmark, DocumentBlank, Edit, Folder, FolderAdd, Locked, PinFilled, Upload } from '@carbon/icons-react'
import { homeSummary } from './home-utils'
import { createPlannedTask, updateTask } from './daybook-service'
import { explainError } from './firebase'
import useDayBookSchedules from './useDayBookSchedules'
import useOnline from './useOnline'

function Updated({ item, today }) {
  const value = item.updatedAt?.toDate?.() || item.createdAt?.toDate?.()
  if (!value) return <span>Just now</span>
  const year = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(value)
  const label = new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', ...(year !== today.slice(0,4) ? { year: 'numeric' } : {}), timeZone: 'Asia/Kolkata' }).format(value)
  const full = new Intl.DateTimeFormat('en-IN', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(value)
  return <time dateTime={value.toISOString()} title={`Last updated ${full}`} aria-label={`Last updated ${full}`}>{label}</time>
}

export default function HomeDashboard({ uid, date, taskState, items, unlockedFolders, archiveLoading, archivePartial, archiveError, onOpen, onNote, onFolder, onUpload, onDayBook, onNotes, onMemories, uploading, toast }) {
  const online = useOnline(), schedules = useDayBookSchedules(uid, date)
  const [title, setTitle] = useState(''), [adding, setAdding] = useState(false), [saving, setSaving] = useState([]), [error, setError] = useState('')
  const input = useRef(null), addLock = useRef(false), taskLocks = useRef(new Set())
  const summary = homeSummary(items, taskState.tasks, date, unlockedFolders)
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00Z'))
  const taskError = error || taskState.error || schedules.error
  async function addTask(event) {
    event.preventDefault()
    if (!title.trim() || addLock.current) return
    addLock.current = true; setAdding(true); setError('')
    try { await createPlannedTask(uid, { title: title.trim(), date, priority: 'normal', repeat: 'none', weekdays: [] }); setTitle(''); input.current?.focus() }
    catch (failure) { setError(explainError(failure)) }
    finally { addLock.current = false; setAdding(false) }
  }
  async function toggle(task) {
    if (taskLocks.current.has(task.id)) return
    taskLocks.current.add(task.id); setSaving([...taskLocks.current]); setError('')
    try { await updateTask(uid, task.id, { done: !task.done }, task.title) }
    catch (failure) { setError(explainError(failure)) }
    finally { taskLocks.current.delete(task.id); setSaving([...taskLocks.current]) }
  }
  return <section className="home-page" aria-labelledby="home-title">
    <header className="home-heading"><div><h1 id="home-title">Home</h1><p>Your day, a little more organised.</p></div><time className="home-date" dateTime={date}><Calendar size={16}/>{dateLabel}</time></header>
    {toast && <p className="home-feedback" role="status"><Checkmark size={16}/>{toast}</p>}
    <nav className="home-quick-actions" aria-label="Quick actions">
      <button type="button" className="home-action-primary" onClick={onNote}><Edit size={18}/><span>New note</span></button>
      <button type="button" onClick={()=>{input.current?.focus();input.current?.scrollIntoView({block:'nearest',behavior:'smooth'})}}><Add size={18}/><span>Add task</span></button>
      <button type="button" onClick={onUpload} disabled={!!uploading || !online}><Upload size={18}/><span>{uploading ? 'Uploading…' : 'Upload'}</span></button>
      <button type="button" onClick={onFolder}><FolderAdd size={18}/><span>New folder</span></button>
    </nav>
    <div className="home-grid">
      <section className="home-panel home-today" aria-labelledby="home-tasks-title">
        <header className="home-panel-heading"><h2 id="home-tasks-title">Today’s tasks</h2><button type="button" className="home-text-button" onClick={onDayBook}>Open Day Book</button></header>
        {taskError && <p className="home-error" role="alert">{taskError}</p>}
        <div className="home-task-summary" aria-live="polite"><span>{taskState.loading ? 'Loading tasks…' : taskState.error ? 'Tasks unavailable' : <><strong>{summary.pending}</strong> pending<span className="home-summary-divider">·</span><strong>{summary.completed}</strong> completed</>}</span><progress aria-label="Today’s task completion" max={summary.total || 1} value={summary.completed}/></div>
        <form className="home-task-form" onSubmit={addTask}><label className="visually-hidden" htmlFor="home-task-title">New task for today</label><input ref={input} id="home-task-title" type="text" placeholder="What needs doing today?" value={title} onChange={event=>setTitle(event.target.value)} maxLength={200} disabled={adding} autoComplete="off"/><button type="submit" aria-label="Add task for today" disabled={adding || !title.trim()}><Add size={18}/></button></form>
        {taskState.loading && !summary.tasks.length ? <p className="home-empty" role="status">Getting today’s tasks…</p> : summary.tasks.length ? <ul className="home-task-list">{summary.tasks.map(task=><li key={task.id} className={task.done?'is-done':''}><label><input type="checkbox" checked={!!task.done} onChange={()=>toggle(task)} disabled={saving.includes(task.id)} aria-label={`${task.done?'Mark incomplete':'Complete'} ${task.title}`}/><span>{task.title}</span></label>{task.priority==='high'&&!task.done&&<span className="home-priority">High</span>}</li>)}</ul> : !taskState.error && <div className="home-empty"><Checkmark size={20}/><p>No tasks for today yet.<span>Add one above to get started.</span></p></div>}
        {summary.total > summary.tasks.length && <button type="button" className="home-panel-footer" onClick={onDayBook}>View all {summary.total} tasks</button>}
      </section>
      <section className="home-panel home-recent" aria-labelledby="home-notes-title">
        <header className="home-panel-heading"><h2 id="home-notes-title">Recent notes</h2><button type="button" className="home-text-button" onClick={onNotes}>View all</button></header>
        {(archivePartial || !online) && <p className="home-panel-hint">{!online?'Available on this device':'Showing loaded notes while your archive loads…'}</p>}
        {archiveError && <p className="home-error" role="alert">{archiveError}</p>}
        {summary.notes.length ? <ul className="home-note-list">{summary.notes.map(note=><li key={note.id}><button type="button" onClick={()=>onOpen(note)} aria-label={`Open note: ${note.name}`}><span className="home-note-title" title={note.name}>{note.name}</span><span className="home-note-updated"><Updated item={note} today={date}/></span></button></li>)}</ul> : <div className="home-empty"><DocumentBlank size={22}/><p>{archiveLoading?'Loading notes…':archivePartial?'Loading more notes…':'No recent notes to show.'}<span>{!archiveLoading&&!archivePartial?'Create a note or unlock its folder to see it here.':''}</span></p></div>}
      </section>
      <section className="home-panel home-folders" aria-labelledby="home-folders-title">
        <header className="home-panel-heading"><h2 id="home-folders-title"><PinFilled size={15}/>Pinned folders</h2><button type="button" className="home-text-button" onClick={onMemories}>All memories</button></header>
        {summary.folders.length ? <ul className="home-folder-list">{summary.folders.map(folder=><li key={folder.id}><button type="button" onClick={()=>onOpen(folder)}><span className="home-item-icon folder" style={folder.folderColor?{'--home-folder-color':folder.folderColor}:undefined}>{folder.folderLock?<Locked size={21}/>:<Folder size={21}/>}</span><span className="home-folder-body"><span>{folder.name}</span><small>{folder.folderLock?'Password protected':'Folder'}</small></span></button></li>)}</ul> : <div className="home-empty home-folder-empty"><Folder size={23}/><p>{archiveLoading||archivePartial?'Loading pinned folders…':'Keep your go-to folders close.'}<span>{!archiveLoading&&!archivePartial?'Use a folder’s Actions menu → Pin to top.':''}</span></p>{!archiveLoading&&!archivePartial&&<button type="button" className="home-text-button" onClick={onMemories}>Browse folders</button>}</div>}
      </section>
    </div>
  </section>
}
