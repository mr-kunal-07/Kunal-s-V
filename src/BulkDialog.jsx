import { setTrashed } from './trash'
import { useState } from 'react'
import { requireInternet } from './offline'
import { Modal, Select, SelectItem, TextInput, InlineNotification } from '@carbon/react'
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db, explainError } from './firebase'
import { memoriesCollection, removeMemory, openFile } from './memories'
import { canMoveTo, parseTags } from './memory-features'
import { expandSelection, selectionRoots, makeZip } from './bulk-utils'
import { folderAccess, requireFolderAccess } from './folder-lock'

export default function BulkDialog({ action, selected, items, uid, unlockedFolders, onClose, onDone }) {
  const [destination, setDestination] = useState(''), [tags, setTags] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState('')
  const expanded = expandSelection(selected, action === 'download' ? items.filter(i => Boolean(i.deletedAt) === Boolean(selected[0]?.deletedAt)) : items), roots = selectionRoots(selected, items)
  const count = ['delete','purge','restore','download'].includes(action) ? expanded.length : selected.length
  const titles = {move:'Move selected items',tag:'Tag selected items',download:'Download selected items',delete:'Move selected items to Trash?',purge:'Permanently delete selected items?',restore:'Restore selected items?'}
  function path(folder) { const parts=[folder.name], seen=new Set([folder.id]); let id=folder.parentId; while(id && !seen.has(id)){seen.add(id);const parent=items.find(i=>i.id===id);if(!parent)break;parts.unshift(parent.name);id=parent.parentId}return parts.join(' / ') }
  async function submit() {
    if(busy) return
    setBusy(true);setError(''); const completed=[]
    try {
      requireInternet('Bulk archive changes')
      requireFolderAccess(expanded, items, unlockedFolders)
      if (action === 'move' && destination) requireFolderAccess([items.find(item => item.id === destination)], items, unlockedFolders)
      if(action==='move' || action==='tag') {
        const targets=action==='move'?roots:selected
        if(targets.length>400)throw new Error('Select up to 400 items per operation.')
        const additions=action==='tag'?parseTags(tags):[]
        if(action==='tag' && !additions.length)throw new Error('Enter at least one tag.')
        const batch=writeBatch(db)
        for(const item of targets){
          if(!items.some(i=>i.id===item.id))throw new Error('A selected item is no longer available. Close this dialog and select again.')
          if(action==='move' && !canMoveTo(item,destination||null,items))throw new Error('A folder cannot be moved into itself or its contents.')
          const data=action==='move'?{parentId:destination||null}:{tags:parseTags([...(item.tags||[]),...additions].join(','))}
          batch.update(doc(memoriesCollection(uid),item.id),{...data,updatedAt:serverTimestamp()})
        }
        await batch.commit();completed.push(...selected.map(i=>i.id))
      } else if(action==='delete' || action==='restore') {
        const ids = await setTrashed(uid,selected,items,action==='delete');completed.push(...ids)
      } else if(action==='purge') {
        if(expanded.some(i => !i.deletedAt)) throw new Error('Restore this folder first; it contains active items.')
        // Children first. Stop on failure so a folder is not removed before its contents.
        function depth(item){let n=0,id=item.parentId;const seen=new Set();while(id&&!seen.has(id)){seen.add(id);n++;id=items.find(i=>i.id===id)?.parentId}return n}
        for(const item of [...expanded].sort((a,b)=>depth(b)-depth(a))){setProgress(`Deleting ${completed.length+1} of ${expanded.length}`);await removeMemory(uid,item);completed.push(item.id)}
      } else {
        if(expanded.reduce((sum,i)=>sum+(i.size||0),0)>200*1024*1024)throw new Error('Download up to 200 MB at a time. Select fewer items.')
        const files=[],used=new Set(),included=new Set(expanded.map(i=>i.id))
        function safe(name){return name.replace(/[\\/\x00-\x1f:*?"<>|]/g,'_').replace(/^\.+$/,'_')||'untitled'}
        const paths=new Map()
        function archivePath(item){
          if(paths.has(item.id))return paths.get(item.id)
          const parent=included.has(item.parentId)?items.find(i=>i.id===item.parentId):null
          const prefix=parent?archivePath(parent)+'/':''
          const base=prefix+safe(item.name)+(item.kind==='note'||item.kind==='link'?'.txt':'')
          let value=base,n=2;while(used.has(value.toLowerCase()))value=base+` (${n++})`
          used.add(value.toLowerCase());paths.set(item.id,value);return value
        }
        for(const item of expanded){
          setProgress(`Preparing ${files.length+1} of ${expanded.length}`)
          let bytes
          if(item.kind==='folder')bytes=new Uint8Array()
          else if(item.kind==='note'||item.kind==='link')bytes=new TextEncoder().encode(item.kind==='link' ? item.url + '\n\n' + (item.content || '') : item.content || '')
          else {const url=await openFile(item);const response=await fetch(url);if(!response.ok)throw new Error(`Unable to download ${item.name}.`);bytes=new Uint8Array(await response.arrayBuffer())}
          files.push({name:archivePath(item)+(item.kind==='folder'?'/':''),bytes})
        }
        const url=URL.createObjectURL(makeZip(files)),link=document.createElement('a');link.href=url;link.download='kunals-vault.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);completed.push(...selected.map(i=>i.id))
      }
      onDone(completed,action==='download'?'ZIP download started.':`${selected.length} selected items ${action==='move'?'moved':action==='tag'?'tagged':action==='restore'?'restored':action==='delete'?'moved to Trash':'permanently deleted'}.`);onClose()
    }catch(err){setError(`${completed.length?`${completed.length} items completed. `:''}${explainError(err)}`);if(completed.length)onDone(completed,'Some items completed; review the remaining selection.')}finally{setBusy(false);setProgress('')}
  }
  return <Modal open modalHeading={titles[action]} modalLabel={`${count} ITEMS${action==='delete'||action==='download'?' INCLUDING FOLDER CONTENTS':''}`} primaryButtonText={busy?(progress||'Working…'):action==='move'?'Move here':action==='tag'?'Add tags':action==='download'?'Download ZIP':action==='restore'?'Restore':action==='delete'?'Move to Trash':'Delete permanently'} secondaryButtonText="Cancel" primaryButtonDisabled={busy||!selected.length} danger={action==='purge'} onRequestSubmit={submit} onRequestClose={()=>{if(!busy)onClose()}} preventCloseOnClickOutside>
    {error&&<InlineNotification kind="error" title="Operation incomplete" subtitle={error} hideCloseButton lowContrast/>}
    {action==='move'&&<Select id="bulk-destination" labelText="Destination" value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy}><SelectItem value="" text="My space (root)"/>{items.filter(i=>i.kind==='folder'&&!i.deletedAt&&folderAccess(i,items,unlockedFolders).allowed&&roots.every(root=>canMoveTo(root,i.id,items))).sort((a,b)=>path(a).localeCompare(path(b))).map(i=><SelectItem key={i.id} value={i.id} text={path(i)}/>)}</Select>}
    {action==='tag'&&<TextInput id="bulk-tags" labelText="Tags to add" helperText="Comma-separated. Existing tags are preserved. Maximum 20 tags per item." value={tags} onChange={e=>setTags(e.target.value)} disabled={busy} maxLength={1100}/>}
    {action==='purge'&&<p>These items and their folder contents will be permanently deleted. This cannot be undone.</p>}{action==='delete'&&<p>These items and their folder contents will move to Trash. You can restore them later.</p>}{action==='restore'&&<p>Restore these items and their folder contents to the archive.</p>}
    {action==='download'&&<p>Download files and folder contents in one ZIP. Notes are included as text files. Maximum 200 MB per download.</p>}
    <ul className="bulk-item-summary">{selected.slice(0,8).map(item=><li key={item.id}>{item.name}</li>)}{selected.length>8&&<li>and {selected.length-8} more</li>}</ul>
  </Modal>
}



