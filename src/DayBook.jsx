import DayPicker from './DayPicker'
import { displayDay } from './calendar-utils'
import { TaskDetails, WeeklyReview, ScheduleManager } from './DayBookTools'
import { carryForward, materialize, schedulesFor, createPlannedTask } from './daybook-service'
import { useEffect, useState, useRef } from 'react'
import { collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { Button, DatePicker, DatePickerInput, TextInput, Select, SelectItem, InlineNotification, Modal } from '@carbon/react'
import { Add, Edit, TrashCan, Checkmark } from '@carbon/icons-react'
import { db, explainError } from './firebase'
export function todayInIndia() {
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const value=type=>parts.find(part=>part.type===type).value
 return `${value('year')}-${value('month')}-${value('day')}`
}
export default function DayBook({ uid }) {
 const [date,setDate]=useState(todayInIndia),[tasks,setTasks]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[title,setTitle]=useState(''),[priority,setPriority]=useState('normal'),[busy,setBusy]=useState(false),[filter,setFilter]=useState('all'),[editing,setEditing]=useState(null),[editText,setEditText]=useState(''),[removing,setRemoving]=useState(null)
 const [slot,setSlot]=useState('morning'),[repeat,setRepeat]=useState('none'),[weekdays,setWeekdays]=useState([1,2,3,4,5]),[templates,setTemplates]=useState([]),[details,setDetails]=useState(null),[review,setReview]=useState(false),[manage,setManage]=useState(false),[notice,setNotice]=useState('')
 const selectedDate = useRef(date); selectedDate.current = date
 const taskCollection=collection(db,'users',uid,'daybook')
 useEffect(()=>{
  setLoading(true);setTasks([]);setError('');setEditing(null)
  const timer=setTimeout(()=>{setLoading(false);setError('Day Book is taking too long to connect. Check your connection and Firestore rules.')},18000)
  const stop=onSnapshot(query(collection(db,'users',uid,'daybook'),where('date','==',date)),snapshot=>{clearTimeout(timer);setTasks(snapshot.docs.map(entry=>({id:entry.id,...entry.data()})).filter(task=>!task.suppressed));setLoading(false)},err=>{clearTimeout(timer);setError(explainError(err));setLoading(false)})
  return()=>{clearTimeout(timer);stop()}
 },[uid,date])
 useEffect(()=>onSnapshot(schedulesFor(uid),s=>setTemplates(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(explainError(e))),[uid])
 useEffect(()=>{let active=true;materialize(uid,templates,date).catch(e=>{if(active)setError(explainError(e))});return()=>{active=false}},[uid,date,templates])
 async function carry(){setBusy(true);setError('');try{const n=await carryForward(uid,date);setNotice(n?`${n} unfinished tasks moved to ${date}.`:'Nothing moved: yesterday is complete, or recurring tasks already exist for this day.')}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function add(event){event.preventDefault();if(!title.trim()||busy)return;setBusy(true);setError('');try{await createPlannedTask(uid,{title:title.trim(),date:selectedDate.current,priority,slot,repeat,weekdays});setTitle('');setPriority('normal');setRepeat('none')}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function update(id,data){setBusy(true);setError('');try{await updateDoc(doc(taskCollection,id),{...data,updatedAt:serverTimestamp()});if(data.title)setEditing(null)}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 async function remove(){setBusy(true);try{if(removing.recurrenceId)await updateDoc(doc(taskCollection,removing.id),{suppressed:true,updatedAt:serverTimestamp()});else await deleteDoc(doc(taskCollection,removing.id));setRemoving(null)}catch(e){setError(explainError(e))}finally{setBusy(false)}}
 const complete=tasks.filter(task=>task.done).length
 const visible=tasks.filter(task=>filter==='all'||(filter==='done'?task.done:!task.done)).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.priority==='high')-Number(a.priority==='high')||(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0))
 return <section className="daybook"><div className="daybook-heading"><div><h1>Day Book</h1><p>Plan your morning. Check things off as you go.</p></div><div className="daybook-date"><DayPicker value={date} disabled={busy} onChange={value=>{selectedDate.current=value;setDate(value);setNotice('')}} /><Button kind="tertiary" onClick={()=>setDate(todayInIndia())} disabled={busy}>Today</Button></div></div>
 {error&&<InlineNotification kind="error" title="Day Book needs attention" subtitle={error} onCloseButtonClick={()=>setError('')} lowContrast/>}
<div className="daybook-tools"><Button kind="tertiary" disabled={busy} onClick={carry}>Carry yesterday</Button><Button kind="ghost" onClick={()=>setManage(true)}>Recurring schedules</Button><Button kind="ghost" aria-pressed={review} onClick={()=>setReview(!review)}>{review?'Hide week':'Weekly review'}</Button></div>{notice&&<InlineNotification kind="success" title={notice} onCloseButtonClick={()=>setNotice('')} lowContrast/>}{review&&<WeeklyReview uid={uid} date={date} onChoose={setDate}/>}
 <form className="daybook-add" onSubmit={add}><TextInput id="task-title" labelText={`Task for ${displayDay(date)}`} placeholder="What do you want to get done?" value={title} maxLength={300} required disabled={busy} onChange={e=>setTitle(e.target.value)}/><Select id="task-priority" labelText="Priority" value={priority} onChange={e=>setPriority(e.target.value)} disabled={busy}><SelectItem value="normal" text="Normal"/><SelectItem value="high" text="High"/></Select><Select id="task-slot" labelText="Time slot" value={slot} onChange={e=>setSlot(e.target.value)} disabled={busy}>{['morning','afternoon','evening'].map(s=><SelectItem key={s} value={s} text={s[0].toUpperCase()+s.slice(1)}/>)}</Select><Select id="task-repeat" labelText="Repeat" value={repeat} onChange={e=>setRepeat(e.target.value)} disabled={busy}><SelectItem value="none" text="Once"/><SelectItem value="daily" text="Daily"/><SelectItem value="weekdays" text="Selected days"/></Select><Button type="submit" renderIcon={Add} disabled={busy||!title.trim()}>Add task</Button>{repeat==='weekdays'&&<div className="repeat-weekdays" role="group" aria-label="Repeat on weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label,index)=><label key={label}><input type="checkbox" checked={weekdays.includes(index)} disabled={busy} onChange={e=>setWeekdays(current=>e.target.checked?[...current,index]:current.filter(i=>i!==index))}/>{label}</label>)}</div>}</form>
 <div className="daybook-summary"><span>{complete} of {tasks.length} completed</span><progress value={complete} max={tasks.length||1} aria-label="Task completion"/><div className="daybook-filters" role="group" aria-label="Filter tasks">{['all','open','done'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?'All':value==='open'?'To do':'Done'}</button>)}</div></div>
 {loading?<div role="status" aria-label="Loading daily tasks" className="daybook-skeleton">{[0,1,2,3].map(i=><div key={i} className="skeleton-line skeleton-shimmer" aria-hidden="true"/>)}</div>:!visible.length?<div className="daybook-empty">{tasks.length?'No tasks in this view.':'No tasks for this day yet. Add your morning plan above.'}</div>:<div className="daybook-tasks">{visible.map(task=><div key={task.id} className={`daybook-task ${task.done?'done':''}`}><input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.done} disabled={busy} onChange={e=>update(task.id,{done:e.target.checked})}/>{editing===task.id?<form className="daybook-edit" onSubmit={e=>{e.preventDefault();if(editText.trim())update(task.id,{title:editText.trim()})}}><input aria-label="Edit task title" value={editText} maxLength={300} onChange={e=>setEditText(e.target.value)} disabled={busy} autoFocus/><button type="submit" className="icon-button" aria-label="Save task" disabled={busy||!editText.trim()}><Checkmark size={16}/></button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancel</button></form>:<span className="daybook-task-title">{task.title}<span className="task-meta">{task.slot||'morning'}{task.recurrenceId?' · repeats':''}{task.carriedFrom?' · carried forward':''}{task.subtasks?.length?' · '+task.subtasks.filter(s=>s.checked).length+'/'+task.subtasks.length+' subtasks':''}{task.notes?' · notes':''}</span></span>}<select className={`task-priority ${task.priority}`} aria-label={`Priority for ${task.title}`} value={task.priority} disabled={busy} onChange={e=>update(task.id,{priority:e.target.value})}><option value="normal">Normal</option><option value="high">High</option></select><button className="icon-button" aria-label={`Edit ${task.title}`} disabled={busy} onClick={()=>setDetails(task)}><Edit size={16}/></button><button className="icon-button" aria-label={`Delete ${task.title}`} disabled={busy} onClick={()=>setRemoving(task)}><TrashCan size={16}/></button></div>)}</div>}
 {details&&<TaskDetails task={details} uid={uid} onClose={()=>setDetails(null)}/>}{manage&&<ScheduleManager uid={uid} templates={templates} onClose={()=>setManage(false)}/>}
 <Modal open={!!removing} modalHeading="Delete task?" danger primaryButtonText={busy?'Deleting…':'Delete task'} secondaryButtonText="Cancel" primaryButtonDisabled={busy} onRequestSubmit={remove} onRequestClose={()=>{if(!busy)setRemoving(null)}}><p>Remove “{removing?.title}” from this day? This cannot be undone.</p></Modal>
 </section>
}








