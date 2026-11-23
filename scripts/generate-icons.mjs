import sharp from 'sharp'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const directory = new URL('../public/icons/', import.meta.url)
const logo = await readFile(new URL('../public/vault.svg', import.meta.url))
await mkdir(directory, { recursive:true })
for (const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
  await sharp(logo).resize(size,size).png().toFile(fileURLToPath(new URL(name,directory)))
}
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#a8442e"/><svg x="88" y="88" width="336" height="336" viewBox="0 0 32 32">${logo.toString().replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'')}</svg></svg>`)
await sharp(maskable).resize(512,512).png().toFile(fileURLToPath(new URL('maskable-512.png',directory)))
