export function shiftDay(date, offset) { const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10) }
export function weekDates(date) {const day=new Date(date+'T12:00:00Z').getUTCDay();const monday=shiftDay(date,-((day+6)%7));return Array.from({length:7},(_,i)=>shiftDay(monday,i))}
export function isScheduled(template,date){return template.enabled && date>=template.startDate && (template.repeat==='daily'||template.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay()))}
export function occurrenceId(templateId,date){return `repeat_${templateId}_${date}`}
export function weeklyTotals(tasks,dates){return dates.map(date=>{const day=tasks.filter(task=>task.date===date);return {date,total:day.length,done:day.filter(task=>task.done).length,pending:day.filter(task=>!task.done).length}})}
