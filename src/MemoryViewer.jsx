import { setChecklistChecked } from './memories'
import { explainError } from './firebase'
import { useMemo, useState, useRef } from 'react'
import { Modal, Button, InlineNotification } from '@carbon/react'
import { Edit, Launch } from '@carbon/icons-react'
import { cleanHtml } from './NoteEditor'
import { Attachment } from './NoteMedia'
export default function MemoryViewer({ item, uid, onClose, onEdit }) {
 const [checklist,setChecklist]=useState(item.checklist||[]),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const saveLock=useRef(false)
 async function toggle(row,checked){
  if(saveLock.current||item.deletedAt)return
  saveLock.current=true;setSaving(true);setSaved(false);setError('')
  const before=checklist;setChecklist(before.map(value=>value.id===row.id?{...value,checked}:value))
  try {setChecklist(await setChecklistChecked(uid,item.id,row.id,checked));setSaved(true)}
  catch(err){setChecklist(before);setError(explainError(err))}
  finally{saveLock.current=false;setSaving(false)}
 }
 const html=useMemo(()=>item.noteHtml?cleanHtml(item.noteHtml):'',[item.noteHtml])
 let url=''
 if(item.kind==='link'){try{const parsed=new URL(item.url);if(['http:','https:'].includes(parsed.protocol))url=parsed.href}catch{ /* Invalid legacy link is rendered without navigation. */ }}
 return <Modal open passiveModal size="lg" className="memory-view-modal" modalHeading={item.name} modalLabel={item.kind==='link'?'SAVED LINK':'NOTE'} onRequestClose={onClose}>
 <div className="memory-view-meta">{item.memoryDate&&<time dateTime={item.memoryDate}>{item.memoryDate}</time>}{(item.tags||[]).map(tag=><span className="memory-tag" key={tag}>#{tag}</span>)}</div>
 {item.kind==='link'&&url&&<a className="view-saved-link" href={url} target="_blank" rel="noopener noreferrer">{url}<Launch size={16}/></a>}
 {html?<div className="note-editor-content note-readonly" dangerouslySetInnerHTML={{__html:html}}/>:<div className="note-readonly plain-note">{item.content||(!item.checklist?.length&&!item.noteAttachments?.length?'No content.':'')}</div>}
 {error&&<InlineNotification kind="error" title="Checklist not saved" subtitle={error} onCloseButtonClick={()=>setError('')} lowContrast/>}
 {!!checklist.length&&<section className="readonly-checklist" aria-label="Checklist"><h3>Checklist · {checklist.filter(row=>row.checked).length}/{checklist.length}<span className="checklist-save-status" role="status">{saving?'Saving…':saved?'Saved':''}</span></h3>{checklist.map((row,index)=><label className="view-checklist-row" key={row.id||index}><input type="checkbox" checked={Boolean(row.checked)} disabled={saving||!!item.deletedAt||!row.id} onChange={event=>toggle(row,event.target.checked)} aria-label={`Complete ${row.text||'item '+(index+1)}`}/><span className={row.checked?'completed':''}>{row.text||'Untitled item'}</span></label>)}</section>}
 {!!item.noteAttachments?.length&&<section className="note-attachments" aria-label="Attachments">{item.noteAttachments.map(attachment=><Attachment key={attachment.id} item={attachment} readOnly/>)}</section>}
 <div className="memory-view-actions"><Button kind="tertiary" onClick={onClose}>Close</Button>{!item.deletedAt&&<Button renderIcon={Edit} disabled={saving} onClick={()=>{onClose();onEdit({...item,checklist})}}>Edit {item.kind==='link'?'link':'note'}</Button>}</div>
 </Modal>
}

