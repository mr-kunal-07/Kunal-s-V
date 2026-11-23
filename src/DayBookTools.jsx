import { displayDay } from './calendar-utils'
import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { Modal, TextInput, TextArea, Select, SelectItem, InlineNotification, Button } from '@carbon/react'
import NoteChecklist from './NoteChecklist'
import { tasksFor, schedulesFor, updateTask, updateSchedule } from './daybook-service'
import { weekDates, weeklyTotals } from './daybook-utils'
import { explainError } from './firebase'
export function TaskDetails({task,uid,onClose}){
 const [title,setTitle]=useState(task.title),[notes,setNotes]=useState(task.notes||''),[subtasks,setSubtasks]=useState(task.subtasks||[]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function save(){setBusy(true);try{await updateTask(uid,task.id,{title:title.trim(),notes,subtasks},title.trim());onClose()}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 return <Modal open modalHeading="Task details" primaryButtonText={busy?'Saving…':'Save task'} secondaryButtonText="Cancel" primaryButtonDisabled={busy||!title.trim()} onRequestSubmit={save} onRequestClose={()=>{if(!busy)onClose()}} preventCloseOnClickOutside>{error&&<InlineNotification kind="error" title="Cannot save" subtitle={error} hideCloseButton lowContrast/>}<TextInput id="task-detail-title" labelText="Title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={300} disabled={busy}/><TextArea id="task-notes" labelText="Notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={20000} rows={4} disabled={busy}/><NoteChecklist items={subtasks} onChange={setSubtasks} disabled={busy}/><p className="dialog-help">Subtask checkboxes save independently of the main task’s completion.</p></Modal>
}
export function WeeklyReview({uid,date,onChoose}){
 const [tasks,setTasks]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const dates=weekDates(date),start=dates[0],end=dates[6]
 useEffect(()=>{setLoading(true);setError('');const stop=onSnapshot(query(tasksFor(uid),where('date','>=',start),where('date','<=',end)),s=>{setTasks(s.docs.map(d=>d.data()).filter(task=>!task.suppressed));setLoading(false)},e=>{setError(explainError(e));setLoading(false)});return stop},[uid,start,end])
 const totals=weeklyTotals(tasks,dates),done=tasks.filter(t=>t.done).length
 return <section className="weekly-review"><div className="weekly-heading"><h2>Weekly review</h2><span>{displayDay(start)} — {displayDay(end)} · {done}/{tasks.length} done</span></div>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading week…</p>:<div className="weekly-days">{totals.map(day=><button key={day.date} className={date===day.date?'active':''} onClick={()=>onChoose(day.date)}><span>{new Date(day.date+'T12:00:00Z').toLocaleDateString('en',{weekday:'short',timeZone:'UTC'})} {day.date.slice(8)}</span><strong>{day.done}/{day.total}</strong><span>{day.pending} open</span></button>)}</div>}</section>
}
export function ScheduleManager({uid,templates,onClose}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function toggle(t){setBusy(true);try{await updateSchedule(uid,t.id,{enabled:!t.enabled})}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 return <Modal open passiveModal modalHeading="Recurring tasks" onRequestClose={onClose}>{error&&<p role="alert">{error}</p>}{!templates.length?<p>No recurring schedules yet.</p>:templates.map(t=><div className="schedule-row" key={t.id}><div><strong>{t.title}</strong><p>{t.repeat==='daily'?'Daily':t.weekdays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</p></div><Button kind="tertiary" disabled={busy} onClick={()=>toggle(t)}>{t.enabled?'Pause':'Resume'}</Button></div>)}<p className="dialog-help">Pausing prevents future tasks from being generated. Existing tasks stay in your Day Book.</p></Modal>
}




