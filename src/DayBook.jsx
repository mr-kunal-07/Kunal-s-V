import CompactSelect from './CompactSelect'
import DayPicker from './DayPicker'
import { displayDay } from './calendar-utils'
import { TaskDetails, WeeklyReview, ScheduleManager } from './DayBookTools'
import { carryForward, materialize, schedulesFor, createPlannedTask, updateTask, removeTask } from './daybook-service'
import useOnline from './useOnline'
import { useEffect, useState, useRef } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { Button, DatePicker, DatePickerInput, TextInput, Select, SelectItem, InlineNotification, Modal } from '@carbon/react'
import { Add, Edit, TrashCan, Checkmark, Close } from '@carbon/icons-react'
import { explainError } from './firebase'
import { todayInIndia } from './daybook-utils'
export default function DayBook({ uid, date, onDateChange, taskState }) {
 const online = useOnline()
 const { tasks, loading, error: taskError, setError: setTaskError } = taskState
 const [error,setError]=useState(''),[title,setTitle]=useState(''),[priority,setPriority]=useState('normal'),[busy,setBusy]=useState(false),[filter,setFilter]=useState('all'),[editing,setEditing]=useState(null),[editText,setEditText]=useState(''),[removing,setRemoving]=useState(null)
 const [repeat,setRepeat]=useState('none'),[weekdays,setWeekdays]=useState([1,2,3,4,5]),[templates,setTemplates]=useState([]),[details,setDetails]=useState(null),[review,setReview]=useState(false),[manage,setManage]=useState(false),[notice,setNotice]=useState('')
 const selectedDate = useRef(date); selectedDate.current = date
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer)},[notice])
 function changeDate(value) { selectedDate.current=value;onDateChange(value);setNotice('');setError('');setEditing(null) }
 useEffect(()=>onSnapshot(schedulesFor(uid),{includeMetadataChanges:true},s=>setTemplates(s.docs.map(d=>({id:d.id,...d.data(),_pending:d.metadata.hasPendingWrites}))),e=>setError(explainError(e))),[uid])
 useEffect(()=>{if(!online)return;let active=true;materialize(uid,templates.filter(template=>!template._pending),date).catch(e=>{if(active)setError(explainError(e))});return()=>{active=false}},[uid,date,templates,online])
 async function carry(){setBusy(true);setError('');try{const n=await carryForward(uid,date);setNotice(n?`${n} unfinished tasks moved to ${date}.`:'No pending tasks to carry forward.')}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function add(event){event.preventDefault();if(!title.trim()||busy)return;setBusy(true);setError('');try{await createPlannedTask(uid,{title:title.trim(),date:selectedDate.current,priority,repeat,weekdays});setTitle('');setPriority('normal');setRepeat('none')}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function update(id,data){setBusy(true);setError('');try{await updateTask(uid,id,data,tasks.find(task=>task.id===id)?.title);if(data.title)setEditing(null)}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function remove(){setBusy(true);try{await removeTask(uid,removing);setRemoving(null)}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 const complete=tasks.filter(task=>task.done).length
 const visible=tasks.filter(task=>filter==='all'||(filter==='done'?task.done:!task.done)).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.priority==='high')-Number(a.priority==='high')||(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0))
 return <section className="daybook"><div className="daybook-heading"><div className="daybook-date"><DayPicker value={date} disabled={busy} onChange={changeDate} /><Button kind="tertiary" onClick={()=>changeDate(todayInIndia())} disabled={busy}>Today</Button></div></div>
 {(error||taskError)&&<InlineNotification kind="error" title="Day Book needs attention" subtitle={error||taskError} onCloseButtonClick={()=>{setError('');setTaskError('')}} lowContrast/>}
<div className="daybook-tools"><Button kind="tertiary" disabled={busy||!online} title={!online?'Reconnect to carry tasks forward':undefined} onClick={carry}>Carry yesterday</Button><Button kind="ghost" onClick={()=>setManage(true)}>Recurring schedules</Button><Button kind="ghost" aria-pressed={review} onClick={()=>setReview(!review)}>{review?'Hide week':'Weekly review'}</Button></div>{notice&&<div className="vault-toast" role="status" aria-live="polite"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={()=>setNotice('')}><Close size={16}/></button></div>}{review&&<WeeklyReview uid={uid} date={date} onChoose={changeDate}/>}
 <form className="daybook-add" onSubmit={add}><TextInput id="task-title" labelText={`Task for ${displayDay(date)}`} placeholder="What do you want to get done?" value={title} maxLength={300} required disabled={busy} onChange={e=>setTitle(e.target.value)}/><CompactSelect id="task-priority" label="Priority" value={priority} onChange={setPriority} options={[["normal","Normal"],["high","High"]]} disabled={busy}/><CompactSelect id="task-repeat" label="Repeat" value={repeat} onChange={setRepeat} options={[["none","Once"],["daily","Daily"],["weekdays","Selected days"]]} disabled={busy}/><Button type="submit" renderIcon={Add} disabled={busy||!title.trim()}>Add task</Button>{repeat==='weekdays'&&<div className="repeat-weekdays" role="group" aria-label="Repeat on weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,index)=><label key={label}><input type="checkbox" checked={weekdays.includes(index)} disabled={busy} onChange={e=>setWeekdays(current=>e.target.checked?[...current,index]:current.filter(i=>i!==index))}/>{label}</label>)}</div>}</form>
 <div className="daybook-summary"><span>{complete} of {tasks.length} completed</span><progress value={complete} max={tasks.length||1} aria-label="Task completion"/><div className="daybook-filters" role="group" aria-label="Filter tasks">{['all','open','done'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'All':value==='open'?'To do':'Done'}</button>)}</div></div>
 {loading?<div role="status" aria-label="Loading daily tasks" className="daybook-skeleton">{[0,1,2,3].map(i=><div key={i} className="skeleton-line skeleton-shimmer" aria-hidden="true"/>)}</div>:!visible.length?<div className="daybook-empty">{tasks.length?'No tasks in this view.':'No tasks for this day yet. Add your morning plan above.'}</div>:<div className="daybook-tasks">{visible.map(task=><div key={task.id} className={`daybook-task ${task.done?'done':''}`}><input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.done} disabled={busy} onChange={e=>update(task.id,{done:e.target.checked})}/>{editing===task.id?<form className="daybook-edit" onSubmit={e=>{e.preventDefault();if(editText.trim())update(task.id,{title:editText.trim()})}}><input aria-label="Edit task title" value={editText} maxLength={300} onChange={e=>setEditText(e.target.value)} disabled={busy} autoFocus/><button type="submit" className="icon-button" aria-label="Save task" disabled={busy||!editText.trim()}><Checkmark size={16}/></button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></form>:<span className="daybook-task-title">{task.title}<span className="task-meta">{task.recurrenceId?' · repeats':''}{task.carriedFrom?' · carried forward':''}{task.subtasks?.length?' · '+task.subtasks.filter(s=>s.checked).length+'/'+task.subtasks.length+' subtasks':''}{task.notes?' · notes':''}</span></span>}<div className="task-priority-control"><CompactSelect id={`priority-${task.id}`} label={`Priority for ${task.title}`} value={task.priority} onChange={value=>update(task.id,{priority:value})} options={[["normal","Normal"],["high","High"]]} disabled={busy} hideLabel/></div><button className="icon-button" aria-label={`Edit ${task.title}`} disabled={busy} onClick={()=>setDetails(task)}><Edit size={16}/></button><button className="icon-button" aria-label={`Delete ${task.title}`} disabled={busy} onClick={()=>setRemoving(task)}><TrashCan size={16}/></button></div>)}</div>}
 {details&&<TaskDetails task={details} uid={uid} onClose={()=>setDetails(null)}/>}{manage&&<ScheduleManager uid={uid} templates={templates} onClose={()=>setManage(false)}/>}
 <Modal open={!!removing} modalHeading="Delete task?" danger primaryButtonText={busy?'Deleting…':'Delete task'} secondaryButtonText="Cancel" primaryButtonDisabled={busy} onRequestSubmit={remove} onRequestClose={()=>{if(!busy)setRemoving(null)}}><p>Remove “{removing?.title}” from this day? This cannot be undone.</p></Modal>
 </section>
}












