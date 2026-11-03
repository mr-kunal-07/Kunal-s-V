import { collection, doc, getDocs, query, where, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { shiftDay, isScheduled, occurrenceId } from './daybook-utils'
export const tasksFor=uid=>collection(db,'users',uid,'daybook')
export const schedulesFor=uid=>collection(db,'users',uid,'recurringTasks')
export async function materialize(uid,templates,date){
 for(const template of templates.filter(t=>isScheduled(t,date))){const target=doc(tasksFor(uid),occurrenceId(template.id,date));await runTransaction(db,async tx=>{const existing=await tx.get(target);if(!existing.exists())tx.set(target,{title:template.title,date,priority:template.priority,notes:'',subtasks:[],done:false,recurrenceId:template.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})})}
}
export async function carryForward(uid,date){
 const yesterday=shiftDay(date,-1),snapshot=await getDocs(query(tasksFor(uid),where('date','==',yesterday)))
 let moved=0
 for(const entry of snapshot.docs.filter(d=>!d.data().done)){
  const changed=await runTransaction(db,async tx=>{const current=await tx.get(entry.ref);if(!current.exists()||current.data().done||current.data().suppressed||current.data().date!==yesterday)return false;if(current.data().recurrenceId){const target=doc(tasksFor(uid),occurrenceId(current.data().recurrenceId,date));const today=await tx.get(target);if(today.exists())return false;tx.set(target,{...current.data(),date,carriedFrom:yesterday,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});tx.update(entry.ref,{suppressed:true,updatedAt:serverTimestamp()});return true;}tx.update(entry.ref,{date,carriedFrom:yesterday,updatedAt:serverTimestamp()});return true})
  if(changed)moved++
 }
 return moved
}
export async function createPlannedTask(uid,{title,date,priority,repeat,weekdays}){
 const batch=writeBatch(db),data={title,date,priority,notes:'',subtasks:[],done:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}
 if(repeat!=='none'){
  if(repeat==='weekdays'&&!weekdays.length)throw new Error('Choose at least one weekday.')
  const template=doc(schedulesFor(uid));batch.set(template,{title,priority,repeat,weekdays,enabled:true,startDate:date,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
  if(isScheduled({enabled:true,startDate:date,repeat,weekdays},date))batch.set(doc(tasksFor(uid),occurrenceId(template.id,date)),{...data,recurrenceId:template.id})
 }else batch.set(doc(tasksFor(uid)),data)
 await batch.commit()
}



