import { useEffect, useState } from 'react'
import { Modal, Button } from '@carbon/react'
import { Download, Close } from '@carbon/icons-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { auth } from './firebase'
import { recoveryStore } from './offline'

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null), [installed, setInstalled] = useState(false), [help, setHelp] = useState(false), [error, setError] = useState('')
  const { offlineReady:[offlineReady,setOfflineReady], needRefresh:[needRefresh,setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError:()=>setError('Offline app setup could not finish. Reconnect and reopen Keep to retry.') })
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(standalone.matches || navigator.standalone === true)
    const before = event => { event.preventDefault(); setPrompt(event) }
    const done = () => { setInstalled(true); setPrompt(null) }
    update(); standalone.addEventListener('change',update); window.addEventListener('beforeinstallprompt',before); window.addEventListener('appinstalled',done)
    return () => { standalone.removeEventListener('change',update); window.removeEventListener('beforeinstallprompt',before); window.removeEventListener('appinstalled',done) }
  }, [])
  async function install() {
    if (!prompt) { setHelp(true); return }
    try { await prompt.prompt(); await prompt.userChoice } catch { setHelp(true) } finally { setPrompt(null) }
  }
  function update() {
    if (auth.currentUser && recoveryStore.list(auth.currentUser.uid).length) { setError('Let pending changes finish syncing before updating the app.'); return }
    if (document.querySelector('[contenteditable="true"],.cds--modal.is-visible')) { setError('Save or close your open editor before updating.'); return }
    updateServiceWorker(true).catch(()=>setError('Could not update. Please retry when connected.'))
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return <><button type="button" className="install-app-button" onClick={()=>installed?setHelp(true):install()} title={installed?'App installed':'Install Keep'}><Download size={15}/><span>{installed?'Installed':'Install app'}</span></button>
    <Modal open={help} passiveModal modalHeading={installed?'Keep is installed':'Install Keep on your phone'} onRequestClose={()=>setHelp(false)}><div className="install-help"><img src="/icons/icon-192.png" alt="" width="56" height="56"/><p>{installed?'You can open Keep from your home screen.':ios?'In Safari, open Share, then choose Add to Home Screen and tap Add.':'In Chrome on Android, open the browser menu, then choose Install app or Add to Home screen.'}</p><p>Open the HTTPS version of Keep on your phone. The address 127.0.0.1 works only on this computer.</p><p>Sign in and open your notes and Day Book once while connected. You can then reopen the installed app and create notes and tasks offline. Keep syncs when it is open and connected again.</p><p>Offline copies stay on this device. Use a personal device, and keep pending changes until they finish syncing.</p></div></Modal>
    {(needRefresh || offlineReady || error) && <div className="pwa-notice" role="status"><span>{error || (needRefresh?'A Keep update is ready.':'Keep is ready to open offline.')}</span>{needRefresh && <button type="button" onClick={update}>Update</button>}<button type="button" aria-label="Dismiss app notification" onClick={()=>{setNeedRefresh(false);setOfflineReady(false);setError('')}}><Close size={15}/></button></div>}
  </>
}
