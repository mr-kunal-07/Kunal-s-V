import { useEffect, useRef, useState } from 'react'
import { Modal, Button, TextInput, TextArea, InlineNotification } from '@carbon/react'
import { createMemory, updateMemory, uploadFile } from './memories'
import { explainError } from './firebase'
import { parseTags } from './memory-features'
import { originalImageFile, validateOriginalImage } from './image-upload'
export function safeLink(value) {
  const url = new URL(value.trim())
  if (!['https:','http:'].includes(url.protocol)) throw new Error('Use an http:// or https:// URL.')
  return url.href
}
export function LinkDialog({ uid, parentId, item, onClose, onSaved }) {
  const [name,setName]=useState(item?.name||''),[url,setUrl]=useState(item?.url||''),[content,setContent]=useState(item?.content||''),[tags,setTags]=useState((item?.tags||[]).join(', ')),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function save(){setBusy(true);setError('');try{const data={name:name.trim(),url:safeLink(url),content,tags:parseTags(tags)};if(!data.name)throw new Error('Enter a title.');if(item)await updateMemory(uid,item.id,data);else await createMemory(uid,{...data,kind:'link',parentId});onSaved('Link saved.');onClose()}catch(e){setError(explainError(e))}finally{setBusy(false)}}
  return <Modal open modalHeading={item?'Edit saved link':'Save a link'} primaryButtonText={busy?'Saving…':'Save link'} secondaryButtonText="Cancel" primaryButtonDisabled={busy||!name.trim()||!url.trim()} onRequestSubmit={save} onRequestClose={()=>{if(!busy)onClose()}} preventCloseOnClickOutside>{error&&<InlineNotification kind="error" title="Cannot save link" subtitle={error} hideCloseButton lowContrast/>}<TextInput id="link-title" labelText="Title" value={name} maxLength={160} onChange={e=>setName(e.target.value)} disabled={busy}/><TextInput id="link-url" labelText="URL" type="url" placeholder="https://" value={url} maxLength={4000} onChange={e=>setUrl(e.target.value)} disabled={busy}/><TextArea id="link-notes" labelText="Notes" value={content} maxLength={200000} onChange={e=>setContent(e.target.value)} disabled={busy}/><TextInput id="link-tags" labelText="Tags (comma-separated)" value={tags} onChange={e=>setTags(e.target.value)} maxLength={1100} disabled={busy}/>{item&&<Button as="a" kind="ghost" href={safeLink(item.url)} target="_blank" rel="noopener noreferrer">Open website ↗</Button>}</Modal>
}
export function CaptureDialog({ mode, uid, parentId, onClose, onSaved }) {
  const [name,setName]=useState(mode==='audio'?'Voice memory':'Scanned document'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recording,setRecording]=useState(false),[blob,setBlob]=useState(null),[url,setUrl]=useState(''),[seconds,setSeconds]=useState(0),[progress,setProgress]=useState(0)
  const stream=useRef(null),recorder=useRef(null),alive=useRef(true),picker=useRef(null),starting=useRef(false)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop())}},[])
  useEffect(()=>{if(!blob){setUrl('');return;}const value=URL.createObjectURL(blob);setUrl(value);return()=>URL.revokeObjectURL(value)},[blob])
  useEffect(()=>{if(!recording)return;const timer=setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer)},[recording])
  useEffect(()=>{if(seconds>=300&&recorder.current?.state==='recording')recorder.current.stop()},[seconds])
  async function start(){if(starting.current||recording)return;starting.current=true;setError('');try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Recording needs a supported browser on HTTPS or localhost.');const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current){media.getTracks().forEach(t=>t.stop());return}stream.current=media;const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));const instance=new MediaRecorder(media,mime?{mimeType:mime}:undefined),chunks=[];recorder.current=instance;instance.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};instance.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(alive.current){setBlob(new Blob(chunks,{type:instance.mimeType}));setRecording(false)}};instance.onerror=()=>{media.getTracks().forEach(t=>t.stop());if(alive.current){setRecording(false);setError('Recording failed. Try again.')}};setSeconds(0);setBlob(null);instance.start(500);setRecording(true)}catch(e){stream.current?.getTracks().forEach(t=>t.stop());setError(e.name==='NotAllowedError'?'Microphone permission was denied. Allow it and try again.':explainError(e))}finally{starting.current=false}}
  async function save() {
    if (busy || recording || !blob || !name.trim()) return
    setBusy(true); setError('')
    try {
      let file
      if (mode === 'audio') {
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        file = new File([blob], name.trim().replace(/[\\/]/g, '_') + '.' + ext, { type: blob.type })
      } else file = originalImageFile(blob, name)
      await uploadFile(uid, file, parentId, setProgress)
      onSaved(mode === 'audio' ? 'Voice memory saved.' : 'Original image saved.'); onClose()
    } catch (error) { setError(explainError(error)) }
    finally { setBusy(false) }
  }
  function chooseImage(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    try { validateOriginalImage(file); setBlob(file); setError('') }
    catch (error) { setError(error.message) }
  }
  return <Modal open size="lg" modalHeading={mode === 'audio' ? 'Record a voice memory' : 'Scan a document'} primaryButtonText={busy ? `Saving ${Math.round(progress * 100)}%` : 'Save memory'} secondaryButtonText="Cancel" primaryButtonDisabled={busy || recording || !blob || !name.trim()} onRequestSubmit={save} onRequestClose={() => { if (!busy) onClose() }} preventCloseOnClickOutside>
    {error && <InlineNotification kind="error" title="Capture needs attention" subtitle={error} hideCloseButton lowContrast />}
    <TextInput id="capture-title" labelText="Title" value={name} onChange={event => setName(event.target.value)} maxLength={150} disabled={busy || recording} />
    {mode === 'audio' ? <div className="capture-controls">
      <p role="status">{recording ? 'Recording' : 'Duration'}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · 5 minute maximum</p>
      <Button kind="tertiary" disabled={busy} onClick={() => recording ? recorder.current.stop() : start()}>{recording ? 'Stop recording' : blob ? 'Record again' : 'Start recording'}</Button>
      {url && <audio src={url} controls />}
    </div> : <div className="capture-controls">
      <input ref={picker} type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={chooseImage} />
      <Button kind="tertiary" disabled={busy} onClick={() => picker.current.click()}>{blob ? 'Retake / choose image' : 'Camera / choose image'}</Button>
      {url && <div className="scan-preview"><img src={url} alt="Document capture" /></div>}
      <p>Original quality · Up to 100 MB per image. Saved without resizing, compression, filters, or format conversion.</p>
    </div>}
  </Modal>
}
