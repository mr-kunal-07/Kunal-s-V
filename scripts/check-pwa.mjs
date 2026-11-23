import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import vm from 'node:vm'
import sharp from 'sharp'

const root=new URL('../dist/',import.meta.url)
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'))
assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/dashboard');assert.equal(manifest.scope,'/')
for(const icon of manifest.icons){const metadata=await sharp(await readFile(new URL(icon.src.slice(1),root))).metadata();assert.equal(`${metadata.width}x${metadata.height}`,icon.sizes)}
assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'))
const html=await readFile(new URL('index.html',root),'utf8')
assert.ok(html.includes('rel="manifest"'));assert.ok(html.includes('apple-touch-icon'))
let entries=[],navigation
const workbox={precacheAndRoute:values=>{entries=values},cleanupOutdatedCaches:()=>{},registerRoute:route=>{navigation=route},NavigationRoute:class{constructor(handler,options){this.options=options}},createHandlerBoundToURL:url=>{assert.equal(url,'index.html');return ()=>{}}}
const define=(_deps,factory)=>factory(workbox)
vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'),{define,self:{define,addEventListener:()=>{}},URL})
assert.ok(entries.some(entry=>entry.url==='index.html'));assert.ok(entries.some(entry=>entry.url.endsWith('.woff2')))
assert.ok(entries.some(entry=>entry.url.includes('main-')&&entry.url.endsWith('.js')))
assert.ok(navigation.options.denylist.some(pattern=>pattern.test('/__/auth/handler')))
for(const entry of entries){
  assert.ok(!entry.url.startsWith('http'),'Service worker must not cache private Firebase responses');await stat(new URL(entry.url,root))
  if(entry.url.endsWith('.js')) { const code=await readFile(new URL(entry.url,root),'utf8');assert.ok(!code.includes('http://127.0.0.1:9099'),'Production must not use the Auth emulator');assert.ok(!code.includes('"127.0.0.1",8088'),'Production must not use the Firestore emulator') }
}
console.log(`PASS: standalone manifest, PNG/maskable/Apple icons, ${entries.length} precached app assets, offline navigation fallback, and Firebase auth-route exclusion.`)
