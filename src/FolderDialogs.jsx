import { useEffect, useRef, useState } from 'react'
import { InlineNotification, Modal, PasswordInput, TextInput, Toggle } from '@carbon/react'
import { createMemory } from './memories'
import { explainError } from './firebase'
import { createFolderLock, folderLockToken, folderPasswordError, verifyFolderPassword } from './folder-lock'

function Failure({ error }) {
  return error && <InlineNotification kind="error" title="Folder needs attention" subtitle={error} hideCloseButton lowContrast />
}

export function CreateFolderDialog({ uid, parentId, onClose, onSaved }) {
  const [name, setName] = useState(''), [protectedFolder, setProtectedFolder] = useState(false)
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const saving = useRef(false)
  const validation = protectedFolder ? folderPasswordError(password, confirmation) : ''
  async function save() {
    if (saving.current || !name.trim()) return
    if (validation) { setError(validation); return }
    saving.current = true; setBusy(true); setError('')
    try {
      const folderLock = protectedFolder ? await createFolderLock(password) : null
      await createMemory(uid, { name: name.trim(), kind: 'folder', parentId, ...(folderLock ? { folderLock } : {}) })
      setPassword(''); setConfirmation(''); onSaved(protectedFolder ? 'Password-protected folder created.' : 'Folder created.'); onClose()
    } catch (err) { setError(explainError(err)) }
    finally { saving.current = false; setBusy(false) }
  }
  return <Modal open className="folder-password-modal" modalHeading="New folder" modalLabel="NEW FOLDER" primaryButtonText={busy ? 'Creating…' : 'Create folder'} secondaryButtonText="Cancel" primaryButtonDisabled={busy || !name.trim() || !!validation} onRequestSubmit={save} onRequestClose={() => { if (!saving.current) onClose() }} preventCloseOnClickOutside selectorPrimaryFocus="#folder-name">
    <Failure error={error} />
    <TextInput id="folder-name" labelText="Folder name" placeholder="A summer to remember" maxLength={160} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
    <div className="folder-password-option"><Toggle id="protect-folder" labelText="Protect with password" labelA="Off" labelB="On" size="sm" toggled={protectedFolder} onToggle={value => { setProtectedFolder(value); setPassword(''); setConfirmation(''); setError('') }} disabled={busy} /></div>
    {protectedFolder && <div className="folder-password-fields">
      <PasswordInput id="folder-password" labelText="Folder password" helperText="Use 8–128 characters. Keep this password somewhere safe; it cannot be recovered." autoComplete="new-password" maxLength={128} value={password} onChange={event => { setPassword(event.target.value); setError('') }} disabled={busy} />
      <PasswordInput id="folder-password-confirmation" labelText="Confirm password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={event => { setConfirmation(event.target.value); setError('') }} invalid={!!confirmation && password !== confirmation} invalidText="The passwords do not match." disabled={busy} />
      <p className="dialog-help">The password is required to view this folder in the app. Stored files are not encrypted.</p>
    </div>}
  </Modal>
}

export function UnlockFolderDialog({ folder, onClose, onUnlocked }) {
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const checking = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function unlock() {
    if (checking.current || !password) return
    checking.current = true; setBusy(true); setError('')
    try {
      if (!await verifyFolderPassword(password, folder.folderLock)) throw new Error('Incorrect password. Try again.')
      if (mounted.current) { setPassword(''); onUnlocked(folder.id, folderLockToken(folder.folderLock)); onClose() }
    } catch (err) { if (mounted.current) setError(explainError(err)) }
    finally { checking.current = false; if (mounted.current) setBusy(false) }
  }
  return <Modal open className="folder-password-modal" modalHeading={`Unlock “${folder.name}”`} modalLabel="PASSWORD-PROTECTED FOLDER" primaryButtonText={busy ? 'Unlocking…' : 'Unlock folder'} secondaryButtonText="Cancel" primaryButtonDisabled={busy || !password} onRequestSubmit={unlock} onRequestClose={() => { if (!checking.current) onClose() }} preventCloseOnClickOutside selectorPrimaryFocus="#unlock-folder-password">
    <p className="dialog-help">Enter this folder’s password. It will lock again when you refresh or sign out.</p>
    <Failure error={error} />
    <PasswordInput id="unlock-folder-password" labelText="Folder password" autoComplete="off" maxLength={128} value={password} onChange={event => { setPassword(event.target.value); setError('') }} disabled={busy} invalid={!!error} invalidText={error} />
  </Modal>
}
